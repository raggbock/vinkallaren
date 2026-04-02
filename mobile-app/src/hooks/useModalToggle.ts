import { useCallback, useState } from "react";

export function useModalToggle(initial = false) {
  const [visible, setVisible] = useState(initial);
  return {
    visible,
    open: useCallback(() => setVisible(true), []),
    close: useCallback(() => setVisible(false), []),
  };
}
