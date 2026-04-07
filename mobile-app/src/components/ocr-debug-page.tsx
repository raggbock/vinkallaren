import { useCallback, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { preprocessImageForOcr, parseWineLabel, normalizeOcrText, lineQuality } from "../lib/label-ocr";
import { computeImageHashes, hashSimilarity } from "../lib/image-hash";
import { matchCatalogByText, matchCatalogByImage, mergeHybridMatches } from "../lib/catalog-search";
import type { LabelParseResult, PreprocessOptions } from "../lib/label-ocr";
import type { CatalogTextMatch } from "../types/product-catalog";

type ScoredLine = { text: string; quality: number; kept: boolean };

type OcrRun = {
  label: string;
  preprocessedUri: string;
  scoredLines: ScoredLine[];
  parsed: LabelParseResult;
  durationMs: number;
  confidence: number;
};

type BatchResult = {
  fileName: string;
  imageUri: string;
  ocrName: string | null;
  ocrConfidence: number;
  hashCrops: { label: string; hash: string }[];
  hybridMatches: CatalogTextMatch[];
  durationMs: number;
};

const PRESETS: { label: string; opts: PreprocessOptions }[] = [
  { label: "Gråskala", opts: { mode: "grayscale", contrast: 1.4, sharpen: false } },
  { label: "Gråskala + skärpa", opts: { mode: "grayscale", contrast: 1.6, sharpen: true } },
  { label: "Gråskala (mild)", opts: { mode: "grayscale", contrast: 1.2, sharpen: false } },
  { label: "Mjuk (binär)", opts: { mode: "global", contrast: 1.4, threshold: 160, sharpen: false } },
  { label: "Mjuk hög (binär)", opts: { mode: "global", contrast: 1.2, threshold: 145, sharpen: false } },
];

type Tab = "single" | "batch";

export function OcrDebugPage({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("single");

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Text style={s.title}>OCR Debug</Text>
        <Pressable onPress={onClose} style={s.closeBtn}>
          <Text style={s.closeBtnText}>Stäng</Text>
        </Pressable>
      </View>

      <View style={s.tabRow}>
        <Pressable onPress={() => setTab("single")} style={[s.tab, tab === "single" && s.tabActive]}>
          <Text style={[s.tabText, tab === "single" && s.tabTextActive]}>Enskild bild</Text>
        </Pressable>
        <Pressable onPress={() => setTab("batch")} style={[s.tab, tab === "batch" && s.tabActive]}>
          <Text style={[s.tabText, tab === "batch" && s.tabTextActive]}>Batch-test</Text>
        </Pressable>
      </View>

      {tab === "single" ? <SingleImageTest /> : <BatchTest />}
      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

// ── Single image test (existing functionality) ──────────────────────

function SingleImageTest() {
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
      reader.onload = () => { setImageUri(reader.result as string); setRuns([]); };
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
    const ocrOpts = { tessedit_pageseg_mode: "3", preserve_interword_spaces: "1" } as Record<string, string>;

    setProgress("Kör utan förbehandling...");
    const t0 = performance.now();
    const raw = await Tesseract.recognize(imageUri, "swe+eng", ocrOpts);
    results.push(buildRun("Rå bild", imageUri, raw.data, performance.now() - t0));

    for (const preset of PRESETS) {
      setProgress(`Kör: ${preset.label}...`);
      try {
        const processed = await preprocessImageForOcr(imageUri, preset.opts);
        const t1 = performance.now();
        const result = await Tesseract.recognize(processed, "swe+eng", ocrOpts);
        results.push(buildRun(preset.label, processed, result.data, performance.now() - t1));
      } catch (err) {
        results.push({ label: `${preset.label} (FEL)`, preprocessedUri: "", scoredLines: [], parsed: emptyParsed(), durationMs: 0, confidence: 0 });
      }
    }

    results.sort((a, b) => b.confidence - a.confidence);
    setRuns(results);
    setBusy(false);
    setProgress("");
  }, [imageUri]);

  return (
    <>
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
          {run.preprocessedUri ? <Image source={{ uri: run.preprocessedUri }} style={s.previewSmall} resizeMode="contain" /> : null}
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
    </>
  );
}

// ── Batch test ──────────────────────────────────────────────────────

function BatchTest() {
  const [results, setResults] = useState<BatchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  const handleBatchPick = useCallback(() => {
    if (Platform.OS !== "web") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files ?? []);
      if (files.length === 0) return;
      setBusy(true);
      setResults([]);

      const Tesseract = await import("tesseract.js");
      const ocrOpts = { tessedit_pageseg_mode: "3", preserve_interword_spaces: "1" } as Record<string, string>;
      const batchResults: BatchResult[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`${i + 1}/${files.length}: ${file.name}`);

        const uri = await readFileAsDataUrl(file);
        const t0 = performance.now();

        // Run best OCR preset (grayscale)
        let bestParsed = emptyParsed();
        let bestConf = 0;
        try {
          const processed = await preprocessImageForOcr(uri, { mode: "grayscale", contrast: 1.4, sharpen: false });
          const { data } = await Tesseract.recognize(processed, "swe+eng", ocrOpts);
          bestConf = Math.round(data.confidence);
          const lines = (data.text ?? "").split("\n").filter((l: string) => l.trim());
          bestParsed = parseWineLabel([{ lines: lines.map((text: string) => ({ text })) }]);
        } catch { /* OCR failed */ }

        // Run pHash
        let hashCrops: { label: string; hash: string }[] = [];
        try {
          hashCrops = await computeImageHashes(uri);
        } catch { /* hash failed */ }

        // Search catalog (hybrid)
        let hybridMatches: CatalogTextMatch[] = [];
        try {
          const normalizedQuery = normalizeOcrText(bestParsed.searchQuery);
          const parsedVintage = bestParsed.vintage ? parseInt(bestParsed.vintage, 10) : null;

          const [textMatches, imageMatches] = await Promise.all([
            normalizedQuery.length >= 3
              ? matchCatalogByText(normalizedQuery, 5, bestParsed.rawSearchQuery, parsedVintage)
              : Promise.resolve([]),
            hashCrops.length > 0
              ? matchCatalogByImage(hashCrops, 5)
              : Promise.resolve([]),
          ]);
          hybridMatches = mergeHybridMatches(textMatches, imageMatches, 5);
        } catch { /* search failed */ }

        batchResults.push({
          fileName: file.name,
          imageUri: uri,
          ocrName: bestParsed.name,
          ocrConfidence: bestConf,
          hashCrops,
          hybridMatches,
          durationMs: Math.round(performance.now() - t0),
        });
        setResults([...batchResults]);
      }

      setBusy(false);
      setProgress("");
    };
    input.click();
  }, []);

  return (
    <>
      <Pressable onPress={handleBatchPick} style={[s.pickBtn, busy && s.disabled]} disabled={busy}>
        {busy ? (
          <View style={s.busyRow}>
            <ActivityIndicator color="#2b1714" />
            <Text style={s.pickBtnText}>{progress}</Text>
          </View>
        ) : (
          <Text style={s.pickBtnText}>Välj testbilder (flera)</Text>
        )}
      </Pressable>

      {results.map((r, i) => (
        <View key={i} style={s.runCard}>
          <View style={s.batchRow}>
            <Image source={{ uri: r.imageUri }} style={s.batchThumb} resizeMode="cover" />
            <View style={s.batchInfo}>
              <Text style={s.runTitle}>{r.fileName}</Text>
              <Text style={s.codeLine}>OCR: {r.ocrName ?? "(inget)"} ({r.ocrConfidence}%)</Text>
              <Text style={s.codeLine}>pHash: {r.hashCrops.map((h) => `${h.label}:${h.hash.slice(0, 8)}…`).join(", ") || "(ingen)"}</Text>
              <Text style={s.codeLine}>Tid: {r.durationMs}ms</Text>
            </View>
          </View>
          {r.hybridMatches.length > 0 ? (
            <View style={s.codeBlock}>
              <Text style={s.sectionTitle}>Träffar (hybrid)</Text>
              {r.hybridMatches.map((m, j) => (
                <Text key={j} style={[s.codeLine, j === 0 && s.keptLine]}>
                  {j + 1}. {m.name} {m.producer ? `(${m.producer})` : ""} — {Math.round(m.similarity * 100)}%
                </Text>
              ))}
            </View>
          ) : (
            <Text style={s.droppedLine}>Inga katalogträffar</Text>
          )}
        </View>
      ))}
    </>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

function buildRun(label: string, uri: string, data: { text: string; confidence: number }, ms: number): OcrRun {
  const rawLines = (data.text ?? "").split("\n").filter((l) => l.trim());
  const blocks = [{ lines: rawLines.map((text) => ({ text })) }];
  const scoredLines = rawLines.map((text) => {
    const quality = lineQuality(text);
    return { text, quality, kept: quality >= 0.4 && text.length >= 3 };
  });
  return { label, preprocessedUri: uri, scoredLines, parsed: parseWineLabel(blocks), durationMs: Math.round(ms), confidence: Math.round(data.confidence) };
}

function emptyParsed(): LabelParseResult {
  return { rawText: "", name: null, producer: null, vintage: null, searchQuery: "", rawSearchQuery: "" };
}

// ── Styles ──────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a0f0d" },
  content: { padding: 18, gap: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "#ead8ca", fontSize: 24, fontWeight: "700" },
  closeBtn: { backgroundColor: "#3d2420", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  closeBtnText: { color: "#ead8ca", fontSize: 14, fontWeight: "600" },
  tabRow: { flexDirection: "row", gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center", backgroundColor: "#3d2420" },
  tabActive: { backgroundColor: "#ead8ca" },
  tabText: { color: "#ead8ca", fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: "#2b1714" },
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
  batchRow: { flexDirection: "row", gap: 12 },
  batchThumb: { width: 80, height: 120, borderRadius: 8, backgroundColor: "#120907" },
  batchInfo: { flex: 1, gap: 4 },
});
