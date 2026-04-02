import { useCallback, useState } from "react";
import type { WsetTastingData } from "../lib/wset-data";

export function useSessionWset() {
  const [data, setData] = useState<WsetTastingData | null>(null);
  const [visible, setVisible] = useState(false);

  const wsetProps = {
    visible,
    wineType: "" as string,
    initialData: data,
    onSave: useCallback((d: WsetTastingData) => { setData(d); setVisible(false); }, []),
    onClose: useCallback(() => setVisible(false), []),
  };

  return {
    data,
    open: useCallback(() => setVisible(true), []),
    wsetProps,
  };
}
