import { useCallback, useState } from "react";
import type { WsetTastingData } from "../lib/wset-data";

export function useSessionWset() {
  const [data, setData] = useState<WsetTastingData | null>(null);
  const [visible, setVisible] = useState(false);
  const [wineType, setWineType] = useState("");

  const wsetProps = {
    visible,
    wineType,
    initialData: data,
    onSave: useCallback((d: WsetTastingData) => { setData(d); setVisible(false); }, []),
    onClose: useCallback(() => setVisible(false), []),
  };

  return {
    data,
    open: useCallback((type?: string) => { setWineType(type || ""); setVisible(true); }, []),
    wsetProps,
  };
}
