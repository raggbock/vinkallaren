import { formatDateFull, formatDateLong, formatDateShort, formatDateISO } from "../format-date";

describe("format-date", () => {
  test("formatDateFull returns Swedish short month format", () => {
    const result = formatDateFull("2026-04-03");
    expect(result).toMatch(/3 apr\. 2026/);
  });

  test("formatDateLong returns Swedish long month format", () => {
    const result = formatDateLong("2026-04-03");
    expect(result).toMatch(/3 april 2026/);
  });

  test("formatDateShort returns day and short month", () => {
    const result = formatDateShort("2026-04-03");
    expect(result).toMatch(/3 apr\./);
  });

  test("formatDateISO returns YYYY-MM-DD", () => {
    expect(formatDateISO("2026-04-03")).toBe("2026-04-03");
  });

  test("handles ISO datetime strings", () => {
    const result = formatDateISO("2026-04-03T14:30:00Z");
    expect(result).toBe("2026-04-03");
  });
});
