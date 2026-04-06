import { useCallback, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { preprocessImageForOcr, parseWineLabel, normalizeOcrText, lineQuality } from "../lib/label-ocr";
import type { LabelParseResult, PreprocessOptions } from "../lib/label-ocr";

type ScoredLine = { text: string; quality: number; kept: boolean };

type OcrRun = {
  label: string;
  preprocessedUri: string;
  rawLines: string[];
  scoredLines: ScoredLine[];
  parsed: LabelParseResult;
  durationMs: number;
  confidence: number;
};

const PRESETS: { label: string; opts: PreprocessOptions }[] = [
  { label: "Mjuk", opts: { mode: "global", contrast: 1.4, threshold: 160, sharpen: false } },
  { label: "Mjuk (låg)", opts: { mode: "global", contrast: 1.2, threshold: 145, sharpen: false } },
  { label: "Mjuk + skärpa", opts: { mode: "global", contrast: 1.4, threshold: 155, sharpen: true } },
  { label: "Mjuk (bred)", opts: { mode: "global", contrast: 1.6, threshold: 170, sharpen: false } },
  { label: "Mjuk (minimal)", opts: { mode: "global", contrast: 1.1, threshold: 135, sharpen: false } },
];

export function OcrDebugPage({ onClose }: { onClose: () => void }) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [runs, setRuns] = useState<OcrRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  const handleFilePick = useCallback(() => {
    if (Platform.OS !== "web") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        setImageUri(reader.result as string);
        setRuns([]);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, []);

  const runAllPasses = useCallback(async () => {
    if (!imageUri) return;
    setBusy(true);
    setRuns([]);
    const Tesseract = await import("tesseract.js");
    const results: OcrRun[] = [];

    // First: raw image without any preprocessing
    setProgress("Kör utan förbehandling...");
    const startRaw = performance.now();
    const rawResult = await Tesseract.recognize(imageUri, "swe+eng", {
      tessedit_pageseg_mode: "3",
      preserve_interword_spaces: "1",
    } as Record<string, string>);
    results.push(buildRun("Rå bild (ingen förbehandling)", imageUri, rawResult.data, performance.now() - startRaw));

    // Then: each preset
    for (const preset of PRESETS) {
      setProgress(`Kör: ${preset.label}...`);
      try {
        const processed = await preprocessImageForOcr(imageUri, preset.opts);
        const start = performance.now();
        const result = await Tesseract.recognize(processed, "swe+eng", {
          tessedit_pageseg_mode: "3",
          preserve_interword_spaces: "1",
        } as Record<string, string>);
        results.push(buildRun(preset.label, processed, result.data, performance.now() - start));
      } catch (err) {
        results.push({ label: `${preset.label} (FEL)`, preprocessedUri: "", rawLines: [String(err)], scoredLines: [], parsed: emptyParsed(), durationMs: 0, confidence: 0 });
      }
    }

    // Sort by confidence (best first)
    results.sort((a, b) => b.confidence - a.confidence);
    setRuns(results);
    setBusy(false);
    setProgress("");
  }, [imageUri]);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Text style={s.title}>OCR Debug</Text>
        <Pressable onPress={onClose} style={s.closeBtn}>
          <Text style={s.closeBtnText}>Stäng</Text>
        </Pressable>
      </View>

      <Pressable onPress={handleFilePick} style={s.pickBtn}>
        <Text style={s.pickBtnText}>{imageUri ? "Byt bild" : "Välj bild / Ta foto"}</Text>
      </Pressable>

      {imageUri && (
        <>
          <Text style={s.sectionTitle}>Originalbild</Text>
          <Image source={{ uri: imageUri }} style={s.preview} resizeMode="contain" />

          <Pressable onPress={runAllPasses} style={[s.pickBtn, busy && s.disabled]} disabled={busy}>
            {busy ? (
              <View style={s.busyRow}>
                <ActivityIndicator color="#2b1714" />
                <Text style={s.pickBtnText}>{progress}</Text>
              </View>
            ) : (
              <Text style={s.pickBtnText}>Kör alla {PRESETS.length + 1} varianter</Text>
            )}
          </Pressable>
        </>
      )}

      {runs.map((run, i) => (
        <View key={i} style={[s.runCard, i === 0 && s.bestCard]}>
          {i === 0 && <Text style={s.bestBadge}>BÄST</Text>}
          <Text style={s.runTitle}>{run.label} — {run.durationMs}ms — {run.confidence}%</Text>

          {run.preprocessedUri ? (
            <Image source={{ uri: run.preprocessedUri }} style={s.previewSmall} resizeMode="contain" />
          ) : null}

          <Text style={s.sectionTitle}>Rader (kvalitet | behållen)</Text>
          <View style={s.codeBlock}>
            {run.scoredLines.length > 0
              ? run.scoredLines.map((line, j) => (
                <Text key={j} style={[s.codeLine, line.kept ? s.keptLine : s.droppedLine]}>
                  [{Math.round(line.quality * 100)}%] {line.kept ? "✓" : "✗"} {line.text}
                </Text>
              ))
              : <Text style={s.codeLine}>(tom)</Text>}
          </View>

          <Text style={s.sectionTitle}>Parsad etikett</Text>
          <View style={s.codeBlock}>
            <Text style={s.codeLine}>Namn: {run.parsed.name ?? "(inget)"}</Text>
            <Text style={s.codeLine}>Producent: {run.parsed.producer ?? "(ingen)"}</Text>
            <Text style={s.codeLine}>Årgång: {run.parsed.vintage ?? "(ingen)"}</Text>
            <Text style={s.codeLine}>Sökfråga: {run.parsed.searchQuery || "(tom)"}</Text>
          </View>

          <Text style={s.sectionTitle}>Normaliserad text</Text>
          <View style={s.codeBlock}>
            <Text style={s.codeLine}>{normalizeOcrText(run.parsed.rawText) || "(tom)"}</Text>
          </View>
        </View>
      ))}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

function buildRun(label: string, uri: string, data: { text: string; confidence: number; blocks?: unknown[] | null }, ms: number): OcrRun {
  const blocks = (data.blocks ?? []).map((b: unknown) => {
    const block = b as { paragraphs?: { lines?: { text: string }[] }[] };
    return { lines: (block.paragraphs ?? []).flatMap((p) => (p.lines ?? []).map((l) => ({ text: l.text }))) };
  });
  const rawLines = (data.text ?? "").split("\n").filter((l) => l.trim());
  const scoredLines = rawLines.map((text) => {
    const quality = lineQuality(text);
    return { text, quality, kept: quality >= 0.4 && text.length >= 3 };
  });
  return {
    label,
    preprocessedUri: uri,
    rawLines,
    scoredLines,
    parsed: parseWineLabel(blocks),
    durationMs: Math.round(ms),
    confidence: Math.round(data.confidence),
  };
}

function emptyParsed(): LabelParseResult {
  return { rawText: "", name: null, producer: null, vintage: null, searchQuery: "", rawSearchQuery: "" };
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a0f0d" },
  content: { padding: 18, gap: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "#ead8ca", fontSize: 24, fontWeight: "700" },
  closeBtn: { backgroundColor: "#3d2420", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  closeBtnText: { color: "#ead8ca", fontSize: 14, fontWeight: "600" },
  pickBtn: { backgroundColor: "#ead8ca", paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  pickBtnText: { color: "#2b1714", fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.6 },
  busyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionTitle: { color: "#ead8ca", fontSize: 14, fontWeight: "700", marginTop: 6 },
  preview: { width: "100%", height: 300, borderRadius: 10, backgroundColor: "#120907" },
  previewSmall: { width: "100%", height: 200, borderRadius: 8, backgroundColor: "#120907" },
  runCard: { backgroundColor: "#2b1714", borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: "#3d2420" },
  bestCard: { borderColor: "#7a9a4a", borderWidth: 2 },
  bestBadge: { color: "#7a9a4a", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  runTitle: { color: "#ead8ca", fontSize: 15, fontWeight: "700" },
  codeBlock: { backgroundColor: "#120907", borderRadius: 8, padding: 10 },
  codeLine: { color: "#c4a882", fontSize: 12, fontFamily: Platform.OS === "web" ? "monospace" : undefined, lineHeight: 18 },
  keptLine: { color: "#7a9a4a" },
  droppedLine: { color: "#6b5045", textDecorationLine: "line-through" as const },
});
