/** Apply `.eq()` or `.is(null)` depending on whether value is null */
export function applyNullableCatalogFilter<
  TQuery extends { eq: (column: string, value: any) => TQuery; is: (column: string, value: null) => TQuery }
>(query: TQuery, column: string, value: string | number | null) {
  return value === null ? query.is(column, null) : query.eq(column, value);
}
