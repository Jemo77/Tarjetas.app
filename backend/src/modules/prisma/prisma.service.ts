import { Global, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const TENANT_MODEL_FIELD: Record<string, string> = {
  Stamp: 'establishmentId',
  LoyaltyCard: 'establishmentId',
  CustomerStats: 'establishmentId',
  CardTemplate: 'establishmentId',
  StampPoint: 'establishmentId',
  EstablishmentMember: 'establishmentId',
  Invitation: 'establishmentId',
  AuditLog: 'establishmentId',
  Subscription: 'establishmentId',
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Conectado a PostgreSQL');
    } catch (err) {
      this.logger.error('No se pudo conectar a PostgreSQL', err as Error);
      throw err;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Cliente extendido que fuerza el `establishmentId` del tenant en las
   * consultas de los modelos del panel (multi-tenancy a nivel de datos).
   * El tenant siempre viene del token de sesión, nunca de params.
   */
  tenantClient(establishmentId: string) {
    return this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, args, query }) {
            const field = TENANT_MODEL_FIELD[model];
            if (field) {
              const where = (args as { where?: Record<string, unknown> }).where ?? {};
              (args as { where?: Record<string, unknown> }).where = { ...where, [field]: establishmentId };
            }
            return query(args);
          },
        },
      },
    });
  }
}