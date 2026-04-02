import { useCallback, useState } from "react";
import type { WsatTastingData } from "../lib/wsat-data";

export function useSessionWsat() {
  const [data, setData] = useState<WsatTastingData | null>(null);
  const [visible, setVisible] = useState(false);

  const wsatProps = {
    visible,
    wineType: "" as string,
    initialData: data,
    onSave: useCallback((d: WsatTastingData) => { setData(d); setVisible(false); }, []),
    onClose: useCallback(() => setVisible(false), []),
  };

  return {
    data,
    open: useCallback(() => setVisible(true), []),
    wsatProps,
  };
}
