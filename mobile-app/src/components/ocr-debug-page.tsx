import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { preprocessImageForOcr, parseWineLabel, normalizeOcrText } from "../lib/label-ocr";
import type { LabelParseResult } from "../lib/label-ocr";

type OcrRun = {
  label: string;
  preprocessedUri: string;
  rawLines: string[];
  parsed: LabelParseResult;
  durationMs: number;
  confidence: number;
};

export function OcrDebugPage({ onClose }: { onClose: () => void }) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [runs, setRuns] = useState<OcrRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [contrast, setContrast] = useState("1.8");
  const [threshold, setThreshold] = useState("140");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    fileInputRef.current = input;
    input.click();
  }, []);

  const runOcr = useCallback(async () => {
    if (!imageUri) return;
    setBusy(true);
    try {
      const Tesseract = await import("tesseract.js");
      const c = parseFloat(contrast) || 1.8;
      const t = parseFloat(threshold) || 140;

      // Run with preprocessing
      const preprocessed = await preprocessImageForOcr(imageUri, { contrast: c, threshold: t });
      const start = performance.now();
      const result = await Tesseract.recognize(preprocessed, "swe+eng", {
        tessedit_pageseg_mode: "6",
        preserve_interword_spaces: "1",
      } as Record<string, string>);
      const duration = performance.now() - start;

      const blocks = (result.data.blocks ?? []).map((b: { paragraphs?: { lines?: { text: string }[] }[] }) => ({
        lines: (b.paragraphs ?? []).flatMap((p) =>
          (p.lines ?? []).map((l) => ({ text: l.text }))
        ),
      }));
      const parsed = parseWineLabel(blocks);
      const rawLines = (result.data.text ?? "").split("\n").filter((l: string) => l.trim());

      setRuns((prev) => [{
        label: `K:${c} T:${t}`,
        preprocessedUri: preprocessed,
        rawLines,
        parsed,
        durationMs: Math.round(duration),
        confidence: Math.round(result.data.confidence),
      }, ...prev]);

      // Also run WITHOUT preprocessing for comparison
      const start2 = performance.now();
      const result2 = await Tesseract.recognize(imageUri, "swe+eng", {
        tessedit_pageseg_mode: "6",
        preserve_interword_spaces: "1",
      } as Record<string, string>);
      const duration2 = performance.now() - start2;
      const blocks2 = (result2.data.blocks ?? []).map((b: { paragraphs?: { lines?: { text: string }[] }[] }) => ({
        lines: (b.paragraphs ?? []).flatMap((p) =>
          (p.lines ?? []).map((l) => ({ text: l.text }))
        ),
      }));
      const parsed2 = parseWineLabel(blocks2);
      const rawLines2 = (result2.data.text ?? "").split("\n").filter((l: string) => l.trim());

      setRuns((prev) => [{
        label: "Utan förbehandling",
        preprocessedUri: imageUri,
        rawLines: rawLines2,
        parsed: parsed2,
        durationMs: Math.round(duration2),
        confidence: Math.round(result2.data.confidence),
      }, ...prev]);

    } catch (err) {
      setRuns((prev) => [{ label: "FEL", preprocessedUri: "", rawLines: [String(err)], parsed: { rawText: "", name: null, producer: null, vintage: null, searchQuery: "", rawSearchQuery: "" }, durationMs: 0, confidence: 0 }, ...prev]);
    } finally {
      setBusy(false);
    }
  }, [imageUri, contrast, threshold]);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Text style={s.title}>OCR Debug</Text>
        <Pressable onPress={onClose} style={s.closeBtn}>
          <Text style={s.closeBtnText}>Stäng</Text>
        </Pressable>
      </View>

      <Pressable onPress={handleFilePick} style={s.pickBtn}>
        <Text style={s.pickBtnText}>
          {imageUri ? "Byt bild" : "Välj bild / Ta foto"}
        </Text>
      </Pressable>

      {imageUri && (
        <>
          <Text style={s.sectionTitle}>Originalbild</Text>
          <Image source={{ uri: imageUri }} style={s.preview} resizeMode="contain" />

          <Text style={s.sectionTitle}>Inställningar</Text>
          <View style={s.row}>
            <View style={s.inputGroup}>
              <Text style={s.label}>Kontrast</Text>
              <TextInput style={s.input} value={contrast} onChangeText={setContrast} keyboardType="numeric" />
            </View>
            <View style={s.inputGroup}>
              <Text style={s.label}>Tröskel (0-255)</Text>
              <TextInput style={s.input} value={threshold} onChangeText={setThreshold} keyboardType="numeric" />
            </View>
          </View>

          <Pressable onPress={runOcr} style={[s.pickBtn, busy && s.disabled]} disabled={busy}>
            {busy ? <ActivityIndicator color="#2b1714" /> : <Text style={s.pickBtnText}>Kör OCR</Text>}
          </Pressable>
        </>
      )}

      {runs.map((run, i) => (
        <View key={i} style={s.runCard}>
          <Text style={s.runTitle}>{run.label} — {run.durationMs}ms — {run.confidence}% konfidens</Text>

          {run.preprocessedUri ? (
            <Image source={{ uri: run.preprocessedUri }} style={s.previewSmall} resizeMode="contain" />
          ) : null}

          <Text style={s.sectionTitle}>Rå Tesseract-output</Text>
          <View style={s.codeBlock}>
            {run.rawLines.map((line, j) => (
              <Text key={j} style={s.codeLine}>{line}</Text>
            ))}
          </View>

          <Text style={s.sectionTitle}>Parsad etikett</Text>
          <View style={s.codeBlock}>
            <Text style={s.codeLine}>Namn: {run.parsed.name ?? "(inget)"}</Text>
            <Text style={s.codeLine}>Producent: {run.parsed.producer ?? "(ingen)"}</Text>
            <Text style={s.codeLine}>Årgång: {run.parsed.vintage ?? "(ingen)"}</Text>
            <Text style={s.codeLine}>Sökfråga: {run.parsed.searchQuery || "(tom)"}</Text>
            <Text style={s.codeLine}>Rå sökfråga: {run.parsed.rawSearchQuery || "(tom)"}</Text>
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a0f0d" },
  content: { padding: 18, gap: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "#ead8ca", fontSize: 24, fontWeight: "700" },
  closeBtn: { backgroundColor: "#3d2420", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  closeBtnText: { color: "#ead8ca", fontSize: 14, fontWeight: "600" },
  pickBtn: { backgroundColor: "#ead8ca", paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  pickBtnText: { color: "#2b1714", fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.5 },
  sectionTitle: { color: "#ead8ca", fontSize: 14, fontWeight: "700", marginTop: 6 },
  preview: { width: "100%", height: 300, borderRadius: 10, backgroundColor: "#120907" },
  previewSmall: { width: "100%", height: 200, borderRadius: 8, backgroundColor: "#120907" },
  row: { flexDirection: "row", gap: 12 },
  inputGroup: { flex: 1 },
  label: { color: "#ead8ca", fontSize: 12, marginBottom: 4 },
  input: { backgroundColor: "#3d2420", color: "#ead8ca", padding: 10, borderRadius: 8, fontSize: 16 },
  runCard: { backgroundColor: "#2b1714", borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: "#3d2420" },
  runTitle: { color: "#ead8ca", fontSize: 15, fontWeight: "700" },
  codeBlock: { backgroundColor: "#120907", borderRadius: 8, padding: 10 },
  codeLine: { color: "#c4a882", fontSize: 12, fontFamily: Platform.OS === "web" ? "monospace" : undefined, lineHeight: 18 },
});
