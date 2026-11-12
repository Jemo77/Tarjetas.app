import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListCustomersQuery } from './dto/analytics.dto.js';
import { daysAgo } from '../../common/utils/dates.js';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // Clientes del panel
  // ============================================================

  async customers(establishmentId: string, query: ListCustomersQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const where: Prisma.CustomerStatsWhereInput = {
      establishmentId,
      ...(query.segment ? { segment: query.segment } : {}),
      ...(query.search
        ? {
            user: {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' as const } },
                { email: { contains: query.search, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
    };
    const orderBy: Prisma.CustomerStatsOrderByWithRelationInput[] =
      query.sort === 'totalStamps'
        ? [{ totalStamps: 'desc' }]
        : query.sort === 'name'
          ? [{ user: { name: 'asc' } }]
          : [{ lastStampDate: 'desc' }];

    const [items, total] = await Promise.all([
      this.prisma.customerStats.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      }),
      this.prisma.customerStats.count({ where }),
    ]);

    const segmentCounts = await this.prisma.customerStats.groupBy({
      by: ['segment'],
      where: { establishmentId },
      _count: { _all: true },
    });

    return {
      items: items.map((c) => ({
        userId: c.userId,
        name: c.user.name,
        email: c.user.email,
        avatarUrl: c.user.avatarUrl,
        totalStamps: c.totalStamps,
        totalCardsCompleted: c.totalCardsCompleted,
        totalRewardsRedeemed: c.totalRewardsRedeemed,
        firstStampDate: c.firstStampDate,
        lastStampDate: c.lastStampDate,
        visitsLast30d: c.visitsLast30d,
        avgDaysBetweenVisits: c.avgDaysBetweenVisits,
        segment: c.segment,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      segments: Object.fromEntries(segmentCounts.map((s) => [s.segment, s._count._all])),
    };
  }

  async customerDetail(establishmentId: string, userId: string) {
    const stats = await this.prisma.customerStats.findUnique({
      where: { userId_establishmentId: { userId, establishmentId } },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } } },
    });
    if (!stats) throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Cliente no encontrado' });

    const cards = await this.prisma.loyaltyCard.findMany({
      where: { userId, establishmentId },
      orderBy: [{ cycle: 'desc' }],
      include: {
        template: { select: { rewardTitle: true, stampsRequired: true } },
        _count: { select: { stamps: { where: { status: 'VALID' } } } },
      },
    });
    const recentStamps = await this.prisma.stamp.findMany({
      where: { userId, establishmentId },
      orderBy: { stampedAt: 'desc' },
      take: 20,
      include: { staff: { select: { name: true } } },
    });

    return {
      customer: {
        ...stats,
        user: stats.user,
      },
      cards: cards.map((c) => ({
        id: c.id,
        cycle: c.cycle,
        status: c.status,
        stampsCount: c._count.stamps,
        stampsRequired: c.stampsRequired,
        rewardTitle: c.template.rewardTitle,
        completedAt: c.completedAt,
        redeemedAt: c.redeemedAt,
        expiresAt: c.expiresAt,
      })),
      recentStamps,
    };
  }

  // ============================================================
  // Métricas del panel del local
  // ============================================================

  async overview(establishmentId: string) {
    const now = new Date();
    const weekAgo = daysAgo(7, now);
    const monthAgo = daysAgo(30, now);
    const today = new Date(now.toISOString().slice(0, 10) + 'T00:00:00.000Z');

    const [
      totalCustomers,
      newThisWeek,
      newThisMonth,
      stampsToday,
      withTwoOrMore,
      avgDays,
      rewardCount,
      cardsInitiated,
      cardsCompleted,
      rewardsRedeemed,
      rewardsExpired,
      pendingRewards,
      segments,
      staffByStamps,
    ] = await Promise.all([
      this.prisma.customerStats.count({ where: { establishmentId } }),
      this.prisma.customerStats.count({ where: { establishmentId, firstStampDate: { gte: weekAgo } } }),
      this.prisma.customerStats.count({ where: { establishmentId, firstStampDate: { gte: monthAgo } } }),
      this.prisma.stamp.count({ where: { establishmentId, stampDate: { gte: today }, status: 'VALID' } }),
      this.prisma.customerStats.count({ where: { establishmentId, totalStamps: { gte: 2 } } }),
      this.prisma.customerStats.aggregate({ where: { establishmentId, avgDaysBetweenVisits: { not: null } }, _avg: { avgDaysBetweenVisits: true } }),
      this.prisma.stamp.count({ where: { establishmentId, stampDate: { gte: monthAgo } } }),
      this.prisma.loyaltyCard.count({ where: { establishmentId } }),
      this.prisma.loyaltyCard.count({ where: { establishmentId, status: { in: ['COMPLETED', 'REDEEMED'] } } }),
      this.prisma.loyaltyCard.count({ where: { establishmentId, status: 'REDEEMED' } }),
      this.prisma.loyaltyCard.count({ where: { establishmentId, status: 'EXPIRED' } }),
      this.prisma.loyaltyCard.count({ where: { establishmentId, status: 'COMPLETED' } }),
      this.prisma.customerStats.groupBy({ by: ['segment'], where: { establishmentId }, _count: { _all: true } }),
      this.prisma.stamp.groupBy({
        by: ['staffId'],
        where: { establishmentId, staffId: { not: null }, status: 'VALID', stampDate: { gte: monthAgo } },
        _count: { _all: true },
      }),
    ]);

    const completedCards = cardsCompleted;

    // Rendimiento del equipo
    const staffList = await this.prisma.stamp.findMany({
      where: { establishmentId, staffId: { not: null }, status: 'VALID', stampDate: { gte: monthAgo } },
      distinct: ['staffId'],
      select: { staffId: true, staff: { select: { id: true, name: true } } },
    });

    return {
      customers: {
        total: totalCustomers,
        newThisWeek,
        newThisMonth,
        returnRate: totalCustomers ? Math.round((withTwoOrMore / totalCustomers) * 1000) / 10 : 0,
        avgDaysBetweenVisits: avgDays._avg.avgDaysBetweenVisits ? Number(avgDays._avg.avgDaysBetweenVisits.toFixed(2)) : null,
      },
      activity: {
        stampsToday,
        stampsLast30d: rewardCount,
      },
      rewards: {
        initiated: cardsInitiated,
        completed: completedCards,
        conversionRate: cardsInitiated ? Math.round((completedCards / cardsInitiated) * 1000) / 10 : 0,
        redeemed: rewardsRedeemed,
        expired: rewardsExpired,
        pending: pendingRewards,
      },
      segments: Object.fromEntries(segments.map((s) => [s.segment, s._count._all])),
      team: staffList.map((row) => ({
        staffId: row.staff?.id,
        name: row.staff?.name ?? '—',
        stamps: staffByStamps.find((s) => s.staffId === row.staffId)?._count._all ?? 0,
      })),
    };
  }

  /** Retención: cuántos clientes llegan a cada cantidad de sellos. */
  async retention(establishmentId: string) {
    const stats = await this.prisma.customerStats.findMany({
      where: { establishmentId },
      select: { totalStamps: true },
    });
    const buckets = [
      { label: '1 sello', min: 1, max: 1 },
      { label: '2 sellos', min: 2, max: 2 },
      { label: '3–4 sellos', min: 3, max: 4 },
      { label: '5–9 sellos', min: 5, max: 9 },
      { label: '10+ sellos', min: 10, max: Number.MAX_SAFE_INTEGER },
    ];
    const rows = buckets.map((b) => ({
      label: b.label,
      customers: stats.filter((s) => s.totalStamps >= b.min && s.totalStamps <= b.max).length,
    }));
    const total = stats.length;
    return { total, rows };
  }

  /** Sellos por día de la semana (últimas 12 semanas). */
  async weekdayHeatmap(establishmentId: string) {
    const since = daysAgo(84);
    const rows = await this.prisma.$queryRaw<{ dow: number; count: number }[]>`
      SELECT EXTRACT(ISODOW FROM "stampDate")::int AS dow, COUNT(*)::int AS count
      FROM "Stamp"
      WHERE "establishmentId" = ${establishmentId} AND "status" = 'VALID' AND "stampDate" >= ${since}::date
      GROUP BY 1 ORDER BY 1
    `;
    const names = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    return {
      days: rows.map((r) => ({ day: names[r.dow - 1] ?? `Día ${r.dow}`, dow: r.dow, count: r.count })),
    };
  }

  // ============================================================
  // Métricas de plataforma (super admin)
  // ============================================================

  async platform() {
    const [establishments, users, customers, stampsLast30d, mrr, trial, suspended, canceled] =
      await Promise.all([
        this.prisma.establishment.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
        this.prisma.user.count({ where: { isActive: true } }),
        this.prisma.customerStats.count(),
        this.prisma.stamp.count({ where: { stampDate: { gte: daysAgo(30) }, status: 'VALID' } }),
        this.prisma.subscription.findMany({
          where: { status: 'ACTIVE' },
          include: { plan: { select: { priceCents: true, interval: true, name: true } } },
        }),
        this.prisma.subscription.count({ where: { status: 'TRIALING' } }),
        this.prisma.establishment.count({ where: { status: 'SUSPENDED', deletedAt: null } }),
        this.prisma.subscription.count({ where: { status: 'CANCELED' } }),
      ]);

    const mrrCents = mrr.reduce((sum, s) => sum + (s.plan.interval === 'MONTHLY' ? s.plan.priceCents : s.plan.priceCents / 12), 0);

    return {
      establishments: {
        total: establishments.reduce((sum, e) => sum + e._count._all, 0),
        byStatus: Object.fromEntries(establishments.map((e) => [e.status, e._count._all])),
        active: establishments.find((e) => e.status === 'ACTIVE')?._count._all ?? 0,
        suspended,
      },
      users: { total: users },
      customers: { total: customers },
      stamps: { last30d: stampsLast30d },
      mrr: { cents: mrrCents, currency: 'ARS', activeSubscriptions: mrr.length },
      subscriptions: { trial: trial, canceled },
    };
  }
}