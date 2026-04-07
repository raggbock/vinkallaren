import { applyNullableCatalogFilter } from "../query-helpers";

describe("applyNullableCatalogFilter", () => {
  test("calls .eq() for non-null values", () => {
    const query = { eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis() };
    applyNullableCatalogFilter(query, "country", "Italien");
    expect(query.eq).toHaveBeenCalledWith("country", "Italien");
    expect(query.is).not.toHaveBeenCalled();
  });
  test("calls .is(null) for null values", () => {
    const query = { eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis() };
    applyNullableCatalogFilter(query, "country", null);
    expect(query.is).toHaveBeenCalledWith("country", null);
    expect(query.eq).not.toHaveBeenCalled();
  });
});
