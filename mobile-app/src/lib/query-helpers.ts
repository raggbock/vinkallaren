/** Escape a value for safe interpolation into a PostgREST .or() filter string. */
export function escapeOrFilterValue(value: string) {
  return value.replace(/[,()]/g, "\\$&");
}

/** Apply `.eq()` or `.is(null)` depending on whether value is null */
export function applyNullableCatalogFilter<
  TQuery extends { eq: (column: string, value: any) => TQuery; is: (column: string, value: null) => TQuery }
>(query: TQuery, column: string, value: string | number | null) {
  return value === null ? query.is(column, null) : query.eq(column, value);
}
