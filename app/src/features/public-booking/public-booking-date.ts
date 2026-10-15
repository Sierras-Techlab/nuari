type LocalSlot = { localDate: string; localTime: string; offset: string };

export function businessToday(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function addLocalDays(date: string, amount: number): string {
  if (!Number.isInteger(amount) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError("Fecha local inválida.");
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(0);
  value.setUTCFullYear(year!, month! - 1, day! + amount);
  value.setUTCHours(12, 0, 0, 0);
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

export function localWeekStart(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError("Fecha local inválida.");
  const value = new Date(`${date}T12:00:00.000Z`);
  if (Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== date) throw new RangeError("Fecha local inválida.");
  return addLocalDays(date, -((value.getUTCDay() + 6) % 7));
}

export function localDateLabel(date: string, options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }): string {
  return new Intl.DateTimeFormat("es-AR", { ...options, timeZone: "UTC" }).format(new Date(`${date}T12:00:00.000Z`));
}

export function localInstantLabel(instant: string, timeZone: string, options: Intl.DateTimeFormatOptions = { dateStyle: "full", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }): string {
  return new Intl.DateTimeFormat("es-AR", { ...options, timeZone }).format(new Date(instant));
}

export function slotTimeLabel(slot: LocalSlot, slots: readonly LocalSlot[]): string {
  const offsets = new Set(slots.filter((candidate) => candidate.localDate === slot.localDate && candidate.localTime === slot.localTime).map((candidate) => candidate.offset));
  return `${slot.localTime}${offsets.size > 1 ? ` · UTC${slot.offset}` : ""}`;
}
