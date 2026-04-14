import React from "react";
import { Image, Pressable, Text, View } from "react-native";

import { getWineStoragePlacementLabel } from "../lib/cellar-helpers";
import type { StorageSpaceRow } from "../types/storage-space";
import type { WineRecord } from "../types/wine";

import type { styles as themeStyles } from "../styles/theme";
type SharedStyles = typeof themeStyles;

export type WineData = Partial<WineRecord> & Pick<WineRecord, "id" | "name" | "type" | "tags" | "food_pairings">;

export type WineCardProps = {
  wine: WineData;
  styles: SharedStyles;
  highlighted?: boolean;
  readonly?: boolean;
  storageSpaceById: Map<string, StorageSpaceRow>;
  onOpenSystembolaget: (productId: string) => void;
  onEditWine: (wine: WineRecord) => void;
  onDrinkWine: (wine: WineRecord) => void;
  onDeleteWine: (wineId: string, imagePath: string | null) => void;
};

export const WineCard = React.memo(function WineCard({
  wine, styles, highlighted, readonly, storageSpaceById,
  onOpenSystembolaget, onEditWine, onDrinkWine, onDeleteWine,
}: WineCardProps) {
  return (
    <View style={[styles.wineCard, highlighted && styles.wineCardHighlighted]}>
      <WineCardHeader wine={wine} styles={styles} storageSpaceById={storageSpaceById} readonly={readonly} />
      <WineCardTags wine={wine} styles={styles} />
      <WineCardPairings wine={wine} styles={styles} />
      <WineCardSystembolaget wine={wine} styles={styles} onOpenSystembolaget={onOpenSystembolaget} />
      {!readonly && wine.notes ? <Text style={styles.notesText}>{wine.notes}</Text> : null}
      {!readonly && (
        <View style={styles.actionRow}>
          <Pressable onPress={() => onEditWine(wine as WineRecord)} style={({ pressed }) => pressed && { opacity: 0.5 }}>
            <Text style={styles.linkText}>Redigera</Text>
          </Pressable>
          <Pressable onPress={() => onDrinkWine(wine as WineRecord)} style={({ pressed }) => [styles.drinkAction, pressed && { opacity: 0.5 }]}>
            <Text style={styles.drinkActionText}>Drick</Text>
          </Pressable>
          <View style={styles.actionSpacer} />
          <Pressable onPress={() => onDeleteWine(wine.id, wine.image_path ?? null)} style={({ pressed }) => pressed && { opacity: 0.5 }}>
            <Text style={styles.dangerText}>Ta bort</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
});

function WineCardHeader({ wine, styles, storageSpaceById, readonly }: {
  wine: WineData; styles: SharedStyles; storageSpaceById: Map<string, StorageSpaceRow>; readonly?: boolean;
}) {
  return (
    <View style={styles.wineCardHeader}>
      {wine.image_url ? (
        <Image source={{ uri: wine.image_url }} style={styles.wineThumbnail} resizeMode="cover" accessibilityLabel={`Bild på ${wine.name}`} />
      ) : null}
      <View style={styles.flex}>
        <Text style={styles.wineType}>{wine.type}</Text>
        <Text style={styles.wineName}>{wine.name}</Text>
        <Text style={styles.wineMeta}>
          {[wine.producer, wine.vintage, wine.grape, [wine.country, wine.region].filter(Boolean).join(", ")].filter(Boolean).join(" • ")}
        </Text>
        {!readonly && (
          <>
            <Text style={styles.locationText}>
              {getWineStoragePlacementLabel(wine as WineRecord, storageSpaceById) || wine.cellar_location || "Ingen plats angiven"}
            </Text>
            {wine.cellar_location && getWineStoragePlacementLabel(wine as WineRecord, storageSpaceById) ? (
              <Text style={styles.notesText}>{wine.cellar_location}</Text>
            ) : null}
          </>
        )}
      </View>
      {!readonly && <View style={styles.quantityBadge}><Text style={styles.quantityBadgeText}>{wine.quantity ?? 0} st</Text></View>}
    </View>
  );
}

function WineCardTags({ wine, styles }: { wine: WineData; styles: SharedStyles }) {
  if (wine.tags.length === 0) return null;
  return (
    <View style={styles.tagRow}>
      {wine.tags.map((tag) => (<View key={`${wine.id}-${tag}`} style={styles.tagPill}><Text style={styles.tagText}>{tag}</Text></View>))}
    </View>
  );
}

const MAX_VISIBLE_PAIRINGS = 3;

function WineCardPairings({ wine, styles }: { wine: WineData; styles: SharedStyles }) {
  if (wine.food_pairings.length === 0) return null;
  const visible = wine.food_pairings.slice(0, MAX_VISIBLE_PAIRINGS);
  const overflow = wine.food_pairings.length - MAX_VISIBLE_PAIRINGS;
  return (
    <View style={styles.foodSection}>
      <View style={styles.foodPairingRow}>
        <Text style={styles.foodPairingLabel}>Passar till</Text>
        <View style={styles.foodPairingTags}>
          {visible.map((p) => (<Text key={`${wine.id}-food-${p}`} style={styles.foodPairingText}>{p}</Text>))}
          {overflow > 0 && <Text style={styles.foodPairingOverflow}>+{overflow}</Text>}
        </View>
      </View>
    </View>
  );
}

function WineCardSystembolaget({ wine, styles, onOpenSystembolaget }: {
  wine: WineData; styles: SharedStyles; onOpenSystembolaget: (productId: string) => void;
}) {
  if (!wine.systembolaget_product_id) return null;
  return (
    <Pressable onPress={() => onOpenSystembolaget(wine.systembolaget_product_id!)} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      <Text style={styles.notesText}>Systembolaget #{wine.systembolaget_product_id} ›</Text>
    </Pressable>
  );
}
