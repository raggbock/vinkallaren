import React, { useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { CellarSummary } from "../hooks/usePublicProfile";
import { getAvatarLetter, type ProfileRow } from "../lib/profile-actions";
import type { TasteProfileData } from "../lib/taste-profile";
import { colors } from "../styles/theme";
import { styles as theme } from "../styles/theme";
import type { PublicWineRow, WineRecord } from "../types/wine";
import { TasteProfile } from "./taste-profile";
import { WineCard } from "./wine-card";

type Props = {
  profile: ProfileRow;
  summary: CellarSummary | null;
  wines: PublicWineRow[];
  tasteProfile: TasteProfileData | null;
  onClose: () => void;
};

type TabId = "overview" | "wines" | "taste";

const TYPE_COLORS: Record<string, string> = {
  Rött: "#722f37",
  Vitt: "#f5e6c8",
  Rosé: "#f4a6b0",
  Bubbel: "#d4e88b",
  Orange: "#e8a84c",
};

const EMPTY_STORAGE = new Map();
const noop = () => {};

export function PublicProfilePage({ profile, summary, wines, tasteProfile, onClose }: Props) {
  const tabs = buildTabs(profile, wines, tasteProfile);
  const [activeTab, setActiveTab] = useState<TabId>(tabs[0]);

  return (
    <View style={s.container}>
      <ProfileHeader profile={profile} summary={summary} onClose={onClose} />
      {tabs.length > 1 && (
        <TabBar tabs={tabs} active={activeTab} onSelect={setActiveTab} />
      )}
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {activeTab === "overview" && <OverviewTab summary={summary} />}
        {activeTab === "wines" && <WinesTab wines={wines} />}
        {activeTab === "taste" && <TasteProfile userId={profile.id} onOpenSession={noop} />}
      </ScrollView>
    </View>
  );
}

function buildTabs(profile: ProfileRow, wines: PublicWineRow[], tasteProfile: TasteProfileData | null): TabId[] {
  const tabs: TabId[] = ["overview"];
  if (profile.show_wines && wines.length > 0) tabs.push("wines");
  if (profile.show_taste_profile && tasteProfile) tabs.push("taste");
  return tabs;
}

function ProfileHeader({ profile, summary, onClose }: {
  profile: ProfileRow; summary: CellarSummary | null; onClose: () => void;
}) {
  const letter = getAvatarLetter(profile.display_name);
  const bgColor = profile.avatar_color ?? colors.accent;
  const bottleCount = summary?.total_bottles ?? 0;

  return (
    <View style={s.header}>
      <View style={[s.avatar, { backgroundColor: bgColor }]}>
        <Text style={s.avatarLetter}>{letter}</Text>
      </View>
      <View style={s.headerInfo}>
        <Text style={s.displayName}>{profile.display_name ?? "Anonym källare"}</Text>
        <Text style={s.headerMeta}>
          {bottleCount} {bottleCount === 1 ? "flaska" : "flaskor"}
          {profile.cellar_code ? ` · #${profile.cellar_code}` : ""}
        </Text>
      </View>
      <Pressable onPress={onClose} style={({ pressed }) => [s.closeBtn, pressed && { opacity: 0.5 }]}>
        <Text style={s.closeBtnText}>✕</Text>
      </Pressable>
    </View>
  );
}

function TabBar({ tabs, active, onSelect }: { tabs: TabId[]; active: TabId; onSelect: (t: TabId) => void }) {
  const labels: Record<TabId, string> = { overview: "Översikt", wines: "Viner", taste: "Smakprofil" };
  return (
    <View style={s.tabBar}>
      {tabs.map((tab) => (
        <Pressable key={tab} onPress={() => onSelect(tab)} style={s.tab}>
          <Text style={[s.tabLabel, active === tab && s.tabLabelActive]}>{labels[tab]}</Text>
          {active === tab && <View style={s.tabIndicator} />}
        </Pressable>
      ))}
    </View>
  );
}

function OverviewTab({ summary }: { summary: CellarSummary | null }) {
  if (!summary) return <Text style={s.hint}>Ingen källarinfo tillgänglig.</Text>;
  return (
    <View style={s.overviewContent}>
      <View style={theme.metricsRow}>
        <StatBox label="Flaskor" value={String(summary.total_bottles)} />
        <StatBox label="Etiketter" value={String(summary.unique_labels)} />
        {summary.avg_vintage ? <StatBox label="Snitt årgång" value={String(Math.round(summary.avg_vintage))} /> : null}
      </View>
      {summary.top_country ? <InfoRow label="Toppland" value={summary.top_country} /> : null}
      {summary.top_grape ? <InfoRow label="Toppdruvslag" value={summary.top_grape} /> : null}
      {summary.type_distribution && <TypeBar distribution={summary.type_distribution} total={summary.total_bottles} />}
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={theme.statBox}>
      <Text style={theme.statBoxValue}>{value}</Text>
      <Text style={theme.statBoxLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

function TypeBar({ distribution, total }: { distribution: Record<string, number>; total: number }) {
  if (total === 0) return null;
  const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  return (
    <View style={s.typeBarSection}>
      <Text style={s.sectionLabel}>Fördelning</Text>
      <View style={s.typeBar}>
        {entries.map(([type, count]) => (
          <View
            key={type}
            style={[s.typeSegment, { flex: count, backgroundColor: TYPE_COLORS[type] ?? colors.surfaceAlt }]}
          />
        ))}
      </View>
      <View style={s.typeLegend}>
        {entries.map(([type, count]) => (
          <View key={type} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: TYPE_COLORS[type] ?? colors.surfaceAlt }]} />
            <Text style={s.legendText}>{type} ({Math.round((count / total) * 100)}%)</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function WinesTab({ wines }: { wines: PublicWineRow[] }) {
  const records = wines as WineRecord[];
  return (
    <FlatList
      data={records}
      keyExtractor={(w) => w.id}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <WineCard
          wine={item}
          styles={theme}
          readonly
          storageSpaceById={EMPTY_STORAGE}
          onOpenSystembolaget={noop}
          onEditWine={noop}
          onDrinkWine={noop}
          onDeleteWine={noop}
        />
      )}
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 14, padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarLetter: { color: "#FFFFFF", fontSize: 22, fontWeight: "700" },
  headerInfo: { flex: 1, gap: 2 },
  displayName: { color: colors.text, fontSize: 20, fontWeight: "700" },
  headerMeta: { color: colors.textSecondary, fontSize: 13 },
  closeBtn: { padding: 8 },
  closeBtnText: { color: colors.textSecondary, fontSize: 18 },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12, gap: 0 },
  tabLabel: { color: colors.textSecondary, fontWeight: "600", fontSize: 13 },
  tabLabelActive: { color: colors.accent },
  tabIndicator: { position: "absolute", bottom: 0, height: 2, width: "80%", backgroundColor: colors.accent, borderRadius: 2 },
  content: { padding: 20, gap: 16 },
  overviewContent: { gap: 14 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  infoLabel: { color: colors.textSecondary, fontSize: 14 },
  infoValue: { color: colors.text, fontWeight: "600", fontSize: 14 },
  typeBarSection: { gap: 10 },
  sectionLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  typeBar: { flexDirection: "row", height: 18, borderRadius: 9, overflow: "hidden" },
  typeSegment: { height: 18 },
  typeLegend: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.textSecondary, fontSize: 12 },
  hint: { color: colors.textSecondary, fontSize: 14, textAlign: "center", paddingTop: 24 },
});
