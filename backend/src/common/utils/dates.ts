/**
 * Convierte un instante al "día calendario local" del establecimiento,
 * devuelto como medianoche UTC para almacenarlo en una columna @db.Date.
 * Ej: 2026-09-24T23:30:00Z convertido a America/Argentina/Buenos_Aires
 * da 2026-09-24T00:00:00Z (porque allá ya es el 24).
 */
export function toCalendarDate(input: Date, timezone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(input);
  // en-CA produce YYYY-MM-DD
  return new Date(`${parts}T00:00:00.000Z`);
}

/** Día calendario de hoy en la zona horaria del local. */
export function todayInTz(timezone: string): Date {
  return toCalendarDate(new Date(), timezone);
}

/** Agrega N días. */
export function addDaysToDate(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400_000);
}

/** Diferencia en días entre dos fechas (valor absoluto). */
export function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** Fecha de hace N días desde hoy (UTC). */
export function daysAgo(days: number, from: Date = new Date()): Date {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
}