import { useEffect, useRef } from "react";
import { Platform, View } from "react-native";

/** Renders an SVG string inside a View on web via direct DOM manipulation */
function WebSvg({ svg, size }: { svg: string; size: number }) {
  const ref = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== "web" || !ref.current) return;
    const el = ref.current as unknown as HTMLDivElement;
    el.innerHTML = svg;
  }, [svg]);
  return <View ref={ref} style={{ width: size, height: size }} />;
}

/** Hand-drawn wine bottle doodle */
export function BottleDoodle({ size = 80, color = "#C83C2D" }: { size?: number; color?: string }) {
  if (Platform.OS !== "web") return <View style={{ width: size, height: size }} />;
  return (
    <WebSvg
      size={size}
      svg={`<svg viewBox="0 0 60 130" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
        <path d="M26 3 Q26 1, 27.5 1 L32.5 1 Q34 1, 34 3 L34 26 Q34 29, 36 32 Q41 42, 41 55 L41 115 Q41 120, 36 122 L24 122 Q19 120, 19 115 L19 55 Q19 42, 25 32 Q26 29, 26 26 Z" stroke="${color}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M26 8 L34 8" stroke="${color}" stroke-width="1" opacity="0.4" stroke-linecap="round"/>
        <rect x="23" y="65" width="14" height="25" rx="2" stroke="${color}" stroke-width="1" fill="none" opacity="0.5"/>
        <path d="M25 75 Q30 72, 35 75" stroke="${color}" stroke-width="0.8" fill="none" opacity="0.4"/>
      </svg>`}
    />
  );
}

/** Hand-drawn wine glass doodle */
export function WineGlassDoodle({ size = 80, color = "#C83C2D" }: { size?: number; color?: string }) {
  if (Platform.OS !== "web") return <View style={{ width: size, height: size }} />;
  return (
    <WebSvg
      size={size}
      svg={`<svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
        <path d="M35 10 Q33 30, 30 45 Q25 60, 50 65 Q75 60, 70 45 Q67 30, 65 10" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M50 65 Q49 80, 50 95" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M35 95 Q42 92, 50 95 Q58 98, 65 95" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M38 35 Q44 42, 50 38 Q56 34, 62 40" stroke="${color}" stroke-width="1" fill="none" opacity="0.4" stroke-linecap="round"/>
      </svg>`}
    />
  );
}

/** Tab icon: wine bottle outline */
export function TabIconCellar({ size = 24, color = "#C83C2D" }: { size?: number; color?: string }) {
  if (Platform.OS !== "web") return <View style={{ width: size, height: size }} />;
  return (
    <WebSvg
      size={size}
      svg={`<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
        <path d="M10.5 1.5 Q10.5 1, 11 1 L13 1 Q13.5 1, 13.5 1.5 L13.5 7 Q13.5 8, 14.5 9.5 Q17 13, 17 16 L17 20.5 Q17 22, 15 22.5 L9 22.5 Q7 22, 7 20.5 L7 16 Q7 13, 9.5 9.5 Q10.5 8, 10.5 7 Z" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M10.5 3.5 L13.5 3.5" stroke="${color}" stroke-width="1" opacity="0.4" stroke-linecap="round"/>
        <rect x="9.5" y="14" width="5" height="4" rx="1" stroke="${color}" stroke-width="0.8" fill="none" opacity="0.5"/>
      </svg>`}
    />
  );
}

/** Tab icon: hand-drawn plus circle */
export function TabIconAdd({ size = 24, color = "#C83C2D" }: { size?: number; color?: string }) {
  if (Platform.OS !== "web") return <View style={{ width: size, height: size }} />;
  return (
    <WebSvg
      size={size}
      svg={`<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
        <circle cx="12" cy="12" r="9.5" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <path d="M12 7.5 L12 16.5" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M7.5 12 L16.5 12" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`}
    />
  );
}

/** Tab icon: wine glass outline */
export function TabIconTasting({ size = 24, color = "#C83C2D" }: { size?: number; color?: string }) {
  if (Platform.OS !== "web") return <View style={{ width: size, height: size }} />;
  return (
    <WebSvg
      size={size}
      svg={`<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
        <path d="M8 2 L16 2 L14.5 9 Q12 13, 12 13 Q12 13, 9.5 9 Z" stroke="${color}" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 13 L12 19" stroke="${color}" stroke-width="1.3" stroke-linecap="round"/>
        <path d="M9 19 L15 19" stroke="${color}" stroke-width="1.3" stroke-linecap="round"/>
      </svg>`}
    />
  );
}

/** Tab icon: open book */
export function TabIconHistory({ size = 24, color = "#C83C2D" }: { size?: number; color?: string }) {
  if (Platform.OS !== "web") return <View style={{ width: size, height: size }} />;
  return (
    <WebSvg
      size={size}
      svg={`<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
        <path d="M12 5 Q8 3, 3 4.5 L3 19 Q8 17.5, 12 19.5" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 5 Q16 3, 21 4.5 L21 19 Q16 17.5, 12 19.5" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 5 L12 19.5" stroke="${color}" stroke-width="1" opacity="0.4" stroke-linecap="round"/>
        <path d="M6 8 L9.5 8" stroke="${color}" stroke-width="0.8" opacity="0.3" stroke-linecap="round"/>
        <path d="M6 10.5 L9 10.5" stroke="${color}" stroke-width="0.8" opacity="0.3" stroke-linecap="round"/>
        <path d="M14.5 8 L18 8" stroke="${color}" stroke-width="0.8" opacity="0.3" stroke-linecap="round"/>
        <path d="M15 10.5 L18 10.5" stroke="${color}" stroke-width="0.8" opacity="0.3" stroke-linecap="round"/>
      </svg>`}
    />
  );
}

export function TabIconDiscover({ size = 24, color = "#C83C2D" }: { size?: number; color?: string }) {
  if (Platform.OS !== "web") return <View style={{ width: size, height: size }} />;
  return (
    <WebSvg
      size={size}
      svg={`<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
        <circle cx="12" cy="12" r="9" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <path d="M15 9 L13 13 L9 15 L11 11 Z" stroke="${color}" stroke-width="1.2" fill="none" stroke-linejoin="round"/>
        <circle cx="12" cy="12" r="1" fill="${color}" opacity="0.5"/>
      </svg>`}
    />
  );
}

/** Squiggly horizontal line divider */
export function SquigglyLine({ color = "#C83C2D", opacity = 0.3 }: { color?: string; opacity?: number }) {
  const ref = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== "web" || !ref.current) return;
    const el = ref.current as unknown as HTMLDivElement;
    el.innerHTML = `<svg viewBox="0 0 400 8" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:8px">
      <path d="M0 4 Q10 1, 20 4 T40 4 T60 4 T80 4 T100 4 T120 4 T140 4 T160 4 T180 4 T200 4 T220 4 T240 4 T260 4 T280 4 T300 4 T320 4 T340 4 T360 4 T380 4 T400 4" stroke="${color}" stroke-width="1.5" fill="none" opacity="${opacity}"/>
    </svg>`;
  }, [color, opacity]);
  if (Platform.OS !== "web") {
    return <View style={{ height: 1, backgroundColor: "#E0D8CE", marginVertical: 8 }} />;
  }
  return <View ref={ref} style={{ width: "100%", height: 8, marginVertical: 4 }} />;
}
