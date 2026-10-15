import { describe, expect, it } from "vitest";
import { addCalendarMonths, calendarGridDates, calendarMonth } from "./public-booking-management-calendar";

describe("public booking management calendar", () => {
  it("builds a Sunday-first six-week grid using business-date arithmetic", () => {
    expect(calendarGridDates("2027-05-01")).toEqual([
      "2027-04-25", "2027-04-26", "2027-04-27", "2027-04-28", "2027-04-29", "2027-04-30", "2027-05-01",
      "2027-05-02", "2027-05-03", "2027-05-04", "2027-05-05", "2027-05-06", "2027-05-07", "2027-05-08",
      "2027-05-09", "2027-05-10", "2027-05-11", "2027-05-12", "2027-05-13", "2027-05-14", "2027-05-15",
      "2027-05-16", "2027-05-17", "2027-05-18", "2027-05-19", "2027-05-20", "2027-05-21", "2027-05-22",
      "2027-05-23", "2027-05-24", "2027-05-25", "2027-05-26", "2027-05-27", "2027-05-28", "2027-05-29",
      "2027-05-30", "2027-05-31", "2027-06-01", "2027-06-02", "2027-06-03", "2027-06-04", "2027-06-05",
    ]);
  });

  it("moves between months without carrying an invalid day across month boundaries", () => {
    expect(calendarMonth("2027-05-24")).toBe("2027-05-01");
    expect(addCalendarMonths("2027-01-01", -1)).toBe("2026-12-01");
    expect(addCalendarMonths("2027-12-01", 1)).toBe("2028-01-01");
  });
});
