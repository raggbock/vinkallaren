import { renderHook, act } from "@testing-library/react-native";
import { useModalToggle } from "../useModalToggle";

describe("useModalToggle", () => {
  test("starts closed by default", () => {
    const { result } = renderHook(() => useModalToggle());
    expect(result.current.visible).toBe(false);
  });
  test("opens and closes", () => {
    const { result } = renderHook(() => useModalToggle());
    act(() => result.current.open());
    expect(result.current.visible).toBe(true);
    act(() => result.current.close());
    expect(result.current.visible).toBe(false);
  });
  test("respects initial value", () => {
    const { result } = renderHook(() => useModalToggle(true));
    expect(result.current.visible).toBe(true);
  });
});
