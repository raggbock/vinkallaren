import { Platform, Text, View } from "react-native";
import { useEffect, useRef } from "react";

export function SvgLogo({ height = 150 }: { height?: number } = {}) {
  const logoRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== "web" || !logoRef.current) return;
    const el = logoRef.current as unknown as HTMLDivElement;
    el.innerHTML = `<svg viewBox="0 0 360 150" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
      <!-- Oval crest — outer border -->
      <ellipse cx="180" cy="72" rx="155" ry="65" fill="none" stroke="#2A2A2A" stroke-width="1.8" opacity="0.14"/>
      <!-- Inner accent border -->
      <ellipse cx="180" cy="72" rx="146" ry="58" fill="none" stroke="#C83C2D" stroke-width="0.6" opacity="0.13"/>

      <!-- Grape cluster ornament top -->
      <circle cx="162" cy="8" r="4" fill="#C83C2D" opacity="0.16"/>
      <circle cx="172" cy="5" r="3.5" fill="#C83C2D" opacity="0.14"/>
      <circle cx="180" cy="7" r="4.2" fill="#C83C2D" opacity="0.17"/>
      <circle cx="189" cy="4.5" r="3.5" fill="#C83C2D" opacity="0.14"/>
      <circle cx="198" cy="8" r="4" fill="#C83C2D" opacity="0.16"/>
      <circle cx="167" cy="13" r="3" fill="#C83C2D" opacity="0.11"/>
      <circle cx="175" cy="12" r="3.2" fill="#C83C2D" opacity="0.1"/>
      <circle cx="185" cy="12" r="3.2" fill="#C83C2D" opacity="0.1"/>
      <circle cx="193" cy="13" r="3" fill="#C83C2D" opacity="0.11"/>
      <!-- Vine leaves hint -->
      <path d="M152 10 Q148 4, 142 6 Q145 2, 150 5" stroke="#2A2A2A" stroke-width="0.7" fill="none" opacity="0.1" stroke-linecap="round"/>
      <path d="M208 10 Q212 4, 218 6 Q215 2, 210 5" stroke="#2A2A2A" stroke-width="0.7" fill="none" opacity="0.1" stroke-linecap="round"/>
      <!-- Tendril -->
      <path d="M142 8 Q136 12, 138 18" stroke="#2A2A2A" stroke-width="0.5" fill="none" opacity="0.08" stroke-linecap="round"/>
      <path d="M218 8 Q224 12, 222 18" stroke="#2A2A2A" stroke-width="0.5" fill="none" opacity="0.08" stroke-linecap="round"/>

      <!-- SEDAN 2026 -->
      <text x="180" y="48" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-size="10" fill="#C83C2D" letter-spacing="4.5" font-weight="600">SEDAN 2026</text>

      <!-- Thin decorative rule -->
      <line x1="105" y1="53" x2="255" y2="53" stroke="#C83C2D" stroke-width="0.35" opacity="0.15"/>

      <!-- Vinkällaren -->
      <text x="180" y="84" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-size="42" fill="#2A2A2A" font-weight="700" letter-spacing="1.5">Vinkällaren</text>

      <!-- Thin decorative rule -->
      <line x1="110" y1="91" x2="250" y2="91" stroke="#C83C2D" stroke-width="0.35" opacity="0.15"/>

      <!-- SAMLA · SMAKA · UPPTÄCK -->
      <text x="180" y="106" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-size="8.5" fill="#555555" letter-spacing="4.5" font-weight="400">SAMLA · SMAKA · UPPTÄCK</text>

      <!-- Small grape ornament bottom -->
      <circle cx="170" cy="133" r="3.2" fill="#C83C2D" opacity="0.12"/>
      <circle cx="180" cy="135" r="3.8" fill="#C83C2D" opacity="0.14"/>
      <circle cx="190" cy="133" r="3.2" fill="#C83C2D" opacity="0.12"/>
      <circle cx="175" cy="138" r="2.5" fill="#C83C2D" opacity="0.09"/>
      <circle cx="185" cy="138" r="2.5" fill="#C83C2D" opacity="0.09"/>
    </svg>`;
  }, []);
  if (Platform.OS !== "web") {
    return <Text style={{ fontFamily: "Georgia", fontSize: 28, fontWeight: "700", color: "#2A2A2A" }}>Vinkällaren</Text>;
  }
  return <View ref={logoRef} style={{ width: "100%", height }} />;
}
