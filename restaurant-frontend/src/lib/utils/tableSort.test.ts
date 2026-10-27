import { describe, expect, it } from "vitest";
import { compareTableNumbers, sortTablesByNumber } from "./tableSort";

describe("table number ordering", () => {
  it("sorts numeric table numbers naturally", () => {
    const tables = [
      { number: "10" },
      { number: "2" },
      { number: "1" },
      { number: "20" },
      { number: "11" },
    ];

    expect(sortTablesByNumber(tables).map((table) => table.number)).toEqual([
      "1",
      "2",
      "10",
      "11",
      "20",
    ]);
  });

  it("sorts prefixed table numbers by their numeric segment", () => {
    const tables = [
      { number: "TBL-10" },
      { number: "TBL-2" },
      { number: "TBL-1" },
    ];

    expect(sortTablesByNumber(tables).map((table) => table.number)).toEqual([
      "TBL-1",
      "TBL-2",
      "TBL-10",
    ]);
  });

  it("returns a sorted copy without mutating the source", () => {
    const tables = [{ number: "10" }, { number: "2" }];
    const sorted = sortTablesByNumber(tables);

    expect(sorted).not.toBe(tables);
    expect(tables.map((table) => table.number)).toEqual(["10", "2"]);
    expect(compareTableNumbers("2", "10")).toBeLessThan(0);
  });
});
