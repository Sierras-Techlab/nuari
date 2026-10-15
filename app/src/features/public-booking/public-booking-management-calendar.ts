import { addLocalDays } from "./public-booking-date";

const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function assertLocalDate(date: string): { year: number; month: number; day: number } {
  const match = datePattern.exec(date);
  if (!match) throw new RangeError("Fecha local inválida.");
  const value = new Date(`${date}T12:00:00.000Z`);
  if (Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== date) throw new RangeError("Fecha local inválida.");
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function calendarMonth(date: string): string {
  const { year, month } = assertLocalDate(date);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function addCalendarMonths(date: string, amount: number): string {
  if (!Number.isInteger(amount)) throw new RangeError("El desplazamiento de mes debe ser entero.");
  const { year, month } = assertLocalDate(date);
  const index = year * 12 + month - 1 + amount;
  const nextYear = Math.floor(index / 12);
  const nextMonth = index - nextYear * 12 + 1;
  if (nextYear < 1 || nextYear > 9999) throw new RangeError("Mes fuera de rango.");
  return `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`;
}

export function calendarGridDates(month: string): string[] {
  const firstDate = calendarMonth(month);
  const weekday = new Date(`${firstDate}T12:00:00.000Z`).getUTCDay();
  const firstCell = addLocalDays(firstDate, -weekday);
  return Array.from({ length: 42 }, (_, index) => addLocalDays(firstCell, index));
}
