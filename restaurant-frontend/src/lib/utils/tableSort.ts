type TableNumber = string | number | null | undefined;

type HasTableNumber = {
  number?: TableNumber;
};

const tableNumberCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/**
 * Compare table numbers naturally so "2" comes before "10" and "TBL-2"
 * comes before "TBL-10".
 */
export function compareTableNumbers(a: TableNumber, b: TableNumber): number {
  return tableNumberCollator.compare(String(a ?? ""), String(b ?? ""));
}

/** Return a naturally sorted copy without mutating the source array. */
export function sortTablesByNumber<T extends HasTableNumber>(
  tables: readonly T[]
): T[] {
  return [...tables].sort((a, b) => compareTableNumbers(a.number, b.number));
}
