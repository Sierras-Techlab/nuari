import { describe, expect, it } from "vitest";
import { addLocalDays, businessToday, localWeekStart, slotTimeLabel } from "./public-booking-date";

describe("public booking local calendar helpers", () => {
  it("derives the business date from the organization timezone", () => {
    expect(businessToday("America/Argentina/Buenos_Aires", new Date("2027-05-14T02:30:00.000Z"))).toBe("2027-05-13");
  });

  it("moves local-date strings across week and year boundaries without browser timezone math", () => {
    expect(localWeekStart("2027-05-14")).toBe("2027-05-10");
    expect(addLocalDays("2027-12-30", 3)).toBe("2028-01-02");
  });

  it("labels repeated local hours with distinct explicit UTC offsets", () => {
    const repeated = [
      { localDate: "2027-11-07", localTime: "01:30", offset: "-04:00" },
      { localDate: "2027-11-07", localTime: "01:30", offset: "-05:00" },
    ];
    expect(slotTimeLabel(repeated[0]!, repeated)).toBe("01:30 · UTC-04:00");
    expect(slotTimeLabel(repeated[1]!, repeated)).toBe("01:30 · UTC-05:00");
    expect(slotTimeLabel({ localDate: "2027-11-07", localTime: "01:30", offset: "-04:00" }, [repeated[0]!])).toBe("01:30");
  });
});
