import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AnimatedModal } from "./animated-modal";
import { useEffect, useState } from "react";
import {
  AROMA_LEXICON,
  APPEARANCE_INTENSITY,
  NOSE_INTENSITY,
  PALATE_SWEETNESS,
  PALATE_ACIDITY,
  PALATE_TANNIN,
  PALATE_ALCOHOL,
  PALATE_BODY,
  PALATE_FLAVOUR_INTENSITY,
  PALATE_FINISH,
  QUALITY_OPTIONS,
  emptyWsatData,
  getColourOptions,
  showTannin,
  type AromaSection,
  type WsatTastingData,
} from "../lib/wsat-data";

const STEP_TITLES = ["Appearance", "Nose", "Palate", "Conclusions"];

export function WsatTastingModal({
  visible,
  wineType,
  initialData,
  onSave,
  onClose,
}: {
  visible: boolean;
  wineType: string;
  initialData: WsatTastingData | null;
  onSave: (data: WsatTastingData) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WsatTastingData>(initialData ?? emptyWsatData());

  useEffect(() => {
    if (!visible) return;
    setData(initialData ?? emptyWsatData());
    setStep(0);
  }, [visible]);

  function handleSave() {
    onSave(data);
    onClose();
  }

  function toggleTag(list: string[], tag: string): string[] {
    return list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag];
  }

  return (
    <AnimatedModal visible={visible} onClose={onClose} mode="centered" cardStyle={styles.card}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>WSET Level 2</Text>
            <Text style={styles.title}>{STEP_TITLES[step]}</Text>
          </View>
          <Text style={styles.stepIndicator}>{step + 1} / {STEP_TITLES.length}</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 0 ? (
            <>
              <OptionRow
                label="Intensitet"
                options={[...APPEARANCE_INTENSITY]}
                selected={data.appearance.intensity}
                onSelect={(v) => setData({ ...data, appearance: { ...data.appearance, intensity: v as WsatTastingData["appearance"]["intensity"] } })}
              />
              <OptionRow
                label="Färg"
                options={getColourOptions(wineType)}
                selected={data.appearance.colour}
                onSelect={(v) => setData({ ...data, appearance: { ...data.appearance, colour: v } })}
              />
            </>
          ) : step === 1 ? (
            <>
              <OptionRow
                label="Intensitet"
                options={[...NOSE_INTENSITY]}
                selected={data.nose.intensity}
                onSelect={(v) => setData({ ...data, nose: { ...data.nose, intensity: v as WsatTastingData["nose"]["intensity"] } })}
              />
              <Text style={styles.sectionLabel}>Aromas</Text>
              <TagSelector
                sections={AROMA_LEXICON}
                selected={data.nose.aromas}
                onToggle={(tag) => setData({ ...data, nose: { ...data.nose, aromas: toggleTag(data.nose.aromas, tag) } })}
              />
              <TextInput
                style={styles.textInput}
                placeholder="Additional aroma notes..."
                placeholderTextColor="#8f8178"
                value={data.nose.aromaNote ?? ""}
                onChangeText={(v) => setData({ ...data, nose: { ...data.nose, aromaNote: v || null } })}
                multiline
              />
            </>
          ) : step === 2 ? (
            <>
              <OptionRow label="Sweetness" options={[...PALATE_SWEETNESS]} selected={data.palate.sweetness} onSelect={(v) => setData({ ...data, palate: { ...data.palate, sweetness: v as any } })} />
              <OptionRow label="Acidity" options={[...PALATE_ACIDITY]} selected={data.palate.acidity} onSelect={(v) => setData({ ...data, palate: { ...data.palate, acidity: v as any } })} />
              {showTannin(wineType) ? (
                <OptionRow label="Tannin" options={[...PALATE_TANNIN]} selected={data.palate.tannin} onSelect={(v) => setData({ ...data, palate: { ...data.palate, tannin: v as any } })} />
              ) : null}
              <OptionRow label="Alcohol" options={[...PALATE_ALCOHOL]} selected={data.palate.alcohol} onSelect={(v) => setData({ ...data, palate: { ...data.palate, alcohol: v as any } })} />
              <OptionRow label="Body" options={[...PALATE_BODY]} selected={data.palate.body} onSelect={(v) => setData({ ...data, palate: { ...data.palate, body: v as any } })} />
              <OptionRow label="Flavour intensity" options={[...PALATE_FLAVOUR_INTENSITY]} selected={data.palate.flavourIntensity} onSelect={(v) => setData({ ...data, palate: { ...data.palate, flavourIntensity: v as any } })} />
              <Text style={styles.sectionLabel}>Flavours</Text>
              <TagSelector
                sections={AROMA_LEXICON}
                selected={data.palate.flavours}
                onToggle={(tag) => setData({ ...data, palate: { ...data.palate, flavours: toggleTag(data.palate.flavours, tag) } })}
              />
              <TextInput
                style={styles.textInput}
                placeholder="Additional flavour notes..."
                placeholderTextColor="#8f8178"
                value={data.palate.flavourNote ?? ""}
                onChangeText={(v) => setData({ ...data, palate: { ...data.palate, flavourNote: v || null } })}
                multiline
              />
              <OptionRow label="Finish" options={[...PALATE_FINISH]} selected={data.palate.finish} onSelect={(v) => setData({ ...data, palate: { ...data.palate, finish: v as any } })} />
            </>
          ) : (
            <OptionRow label="Quality" options={[...QUALITY_OPTIONS]} selected={data.conclusions.quality} onSelect={(v) => setData({ ...data, conclusions: { quality: v as any } })} />
          )}
        </ScrollView>

        <View style={styles.nav}>
          {step > 0 ? (
            <Pressable style={styles.navButtonSecondary} onPress={() => setStep(step - 1)}>
              <Text style={styles.navButtonSecondaryText}>Back</Text>
            </Pressable>
          ) : <View style={{ flex: 1 }} />}
          {step < STEP_TITLES.length - 1 ? (
            <Pressable style={styles.navButtonPrimary} onPress={() => setStep(step + 1)}>
              <Text style={styles.navButtonPrimaryText}>Next</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.navButtonPrimary} onPress={handleSave}>
              <Text style={styles.navButtonPrimaryText}>Save</Text>
            </Pressable>
          )}
        </View>
    </AnimatedModal>
  );
}

// --- Sub-components ---

function OptionRow({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: string[];
  selected: string | null;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.optionRow}>
      <Text style={styles.optionLabel}>{label}</Text>
      <View style={styles.optionChips}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            style={[styles.chip, selected === opt && styles.chipSelected]}
            onPress={() => onSelect(opt)}
          >
            <Text style={[styles.chipText, selected === opt && styles.chipTextSelected]}>
              {opt}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function TagSelector({
  sections,
  selected,
  onToggle,
}: {
  sections: AromaSection[];
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  return (
    <View style={styles.tagSelector}>
      {sections.map((section) => (
        <View key={section.title}>
          <Text style={styles.tagSectionTitle}>{section.title}</Text>
          {section.groups.map((group) => (
            <View key={group.category} style={styles.tagGroup}>
              <Text style={styles.tagGroupLabel}>{group.category}</Text>
              <View style={styles.tagRow}>
                {group.tags.map((tag) => (
                  <Pressable
                    key={tag}
                    style={[styles.tag, selected.includes(tag) && styles.tagSelected]}
                    onPress={() => onToggle(tag)}
                  >
                    <Text style={[styles.tagText, selected.includes(tag) && styles.tagTextSelected]}>
                      {tag}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f8f1e8",
    borderRadius: 20,
    padding: 18,
    width: "90%",
    maxWidth: 420,
    maxHeight: "85%",
    gap: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingBottom: 8,
    gap: 12,
  },
  eyebrow: {
    color: "#6f1d1b",
    letterSpacing: 2,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  title: {
    color: "#2b1714",
    fontSize: 22,
    fontWeight: "700",
  },
  stepIndicator: {
    color: "#8a7568",
    fontSize: 13,
    marginTop: 6,
  },
  closeText: {
    color: "#6f1d1b",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 6,
  },
  content: {
    gap: 14,
    paddingBottom: 16,
  },
  sectionLabel: {
    color: "#6f1d1b",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 4,
  },
  optionRow: {
    gap: 6,
  },
  optionLabel: {
    color: "#2b1714",
    fontSize: 14,
    fontWeight: "600",
  },
  optionChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: "#ead8ca",
    borderWidth: 1,
    borderColor: "#d4bfaa",
  },
  chipSelected: {
    backgroundColor: "#6f1d1b",
    borderColor: "#6f1d1b",
  },
  chipText: {
    color: "#564a40",
    fontSize: 13,
  },
  chipTextSelected: {
    color: "#fff6ee",
    fontWeight: "600",
  },
  tagSelector: {
    gap: 10,
  },
  tagSectionTitle: {
    color: "#8a7568",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
    marginTop: 6,
  },
  tagGroup: {
    gap: 3,
    marginBottom: 4,
  },
  tagGroupLabel: {
    color: "#8a7568",
    fontSize: 11,
    fontWeight: "600",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#ead8ca",
    borderWidth: 1,
    borderColor: "#d4bfaa",
  },
  tagSelected: {
    backgroundColor: "#6f1d1b",
    borderColor: "#6f1d1b",
  },
  tagText: {
    color: "#564a40",
    fontSize: 12,
  },
  tagTextSelected: {
    color: "#f4c38c",
    fontWeight: "600",
  },
  textInput: {
    backgroundColor: "#ead8ca",
    color: "#2b1714",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 50,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#d4bfaa",
  },
  nav: {
    flexDirection: "row",
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#ead8ca",
  },
  navButtonPrimary: {
    flex: 1,
    backgroundColor: "#6f1d1b",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  navButtonPrimaryText: {
    color: "#fff6ee",
    fontSize: 15,
    fontWeight: "700",
  },
  navButtonSecondary: {
    flex: 1,
    backgroundColor: "#ead8ca",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  navButtonSecondaryText: {
    color: "#564a40",
    fontSize: 15,
    fontWeight: "600",
  },
});
