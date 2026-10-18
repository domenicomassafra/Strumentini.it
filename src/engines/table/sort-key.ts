import type { TableNullPolicy, TableSortComparator } from "./operations";

interface SortValue {
  missing: boolean;
  key: string | number;
}

/** Sort keys never rewrite the original CSV cells. Locale decimal commas
 * are unambiguous only without grouping or mixed separators. */
export function rowValue(
  value: string, comparator: TableSortComparator, caseSensitive: boolean,
  nullPolicy: TableNullPolicy, isPolicyNull: (value: string, policy: TableNullPolicy) => boolean,
): SortValue {
  if (isPolicyNull(value, nullPolicy)) return { missing: true, key: "" };
  if (comparator === "numeric") {
    const normalized = /^[+-]?(?:\d+,\d+|,\d+)(?:[eE][+-]?\d+)?$/u.test(value.trim())
      ? value.trim().replace(",", ".") : value;
    const key = Number(normalized);
    return { missing: !Number.isFinite(key), key };
  }
  if (comparator === "date") {
    const key = Date.parse(value);
    return { missing: Number.isNaN(key), key };
  }
  return { missing: false, key: caseSensitive ? value : value.toLowerCase() };
}
