import React from "react";
import { Image, Pressable, Text, View } from "react-native";

import { getWineStoragePlacementLabel } from "../lib/cellar-helpers";
import type { StorageSpaceRow } from "../types/storage-space";
import type { WineRecord } from "../types/wine";

import type { styles as themeStyles } from "../styles/theme";
type SharedStyles = typeof themeStyles;

export type WineCardProps = {
  wine: WineRecord;
  styles: SharedStyles;
  highlighted?: boolean;
  storageSpaceById: Map<string, StorageSpaceRow>;
  onOpenSystembolaget: (productId: string) => void;
  onEditWine: (wine: WineRecord) => void;
  onDrinkWine: (wine: WineRecord) => void;
  onDeleteWine: (wineId: string, imagePath: string | null) => void;
};

export const WineCard = React.memo(function WineCard({
  wine, styles, highlighted, storageSpaceById,
  onOpenSystembolaget, onEditWine, onDrinkWine, onDeleteWine,
}: WineCardProps) {
  return (
    <View style={[styles.wineCard, highlighted && styles.wineCardHighlighted]}>
      <WineCardHeader wine={wine} styles={styles} storageSpaceById={storageSpaceById} />
      <WineCardTags wine={wine} styles={styles} />
      <WineCardPairings wine={wine} styles={styles} />
      <WineCardSystembolaget wine={wine} styles={styles} onOpenSystembolaget={onOpenSystembolaget} />
      <Text style={styles.notesText}>{wine.notes || "Ingen anteckning ännu."}</Text>
      <View style={styles.actionRow}>
        <Pressable onPress={() => onEditWine(wine)}><Text style={styles.linkText}>Redigera</Text></Pressable>
        <Pressable onPress={() => onDrinkWine(wine)}><Text style={styles.linkText}>Drick</Text></Pressable>
        <Pressable onPress={() => onDeleteWine(wine.id, wine.image_path)}><Text style={styles.dangerText}>Ta bort</Text></Pressable>
      </View>
    </View>
  );
});

function WineCardHeader({ wine, styles, storageSpaceById }: {
  wine: WineRecord; styles: SharedStyles; storageSpaceById: Map<string, StorageSpaceRow>;
}) {
  return (
    <View style={styles.wineCardHeader}>
      {wine.image_url ? (
        <Image source={{ uri: wine.image_url }} style={styles.wineThumbnail} resizeMode="cover" />
      ) : null}
      <View style={styles.flex}>
        <Text style={styles.wineType}>{wine.type}</Text>
        <Text style={styles.wineName}>{wine.name}</Text>
        <Text style={styles.wineMeta}>
          {[wine.producer, wine.vintage, wine.grape, [wine.country, wine.region].filter(Boolean).join(", ")].filter(Boolean).join(" • ")}
        </Text>
        <Text style={styles.locationText}>
          {getWineStoragePlacementLabel(wine, storageSpaceById) || wine.cellar_location || "Ingen plats angiven"}
        </Text>
        {wine.cellar_location && getWineStoragePlacementLabel(wine, storageSpaceById) ? (
          <Text style={styles.notesText}>{wine.cellar_location}</Text>
        ) : null}
      </View>
      <View style={styles.quantityBadge}><Text style={styles.quantityBadgeText}>{wine.quantity} st</Text></View>
    </View>
  );
}

function WineCardTags({ wine, styles }: { wine: WineRecord; styles: SharedStyles }) {
  if (wine.tags.length === 0) return null;
  return (
    <View style={styles.tagRow}>
      {wine.tags.map((tag) => (<View key={`${wine.id}-${tag}`} style={styles.tagPill}><Text style={styles.tagText}>{tag}</Text></View>))}
    </View>
  );
}

function WineCardPairings({ wine, styles }: { wine: WineRecord; styles: SharedStyles }) {
  if (wine.food_pairings.length === 0) return null;
  return (
    <View style={styles.foodSection}>
      <Text style={styles.inputLabel}>Passar till</Text>
      <View style={styles.tagRow}>
        {wine.food_pairings.map((pairing) => (<View key={`${wine.id}-food-${pairing}`} style={styles.foodPill}><Text style={styles.foodText}>{pairing}</Text></View>))}
      </View>
    </View>
  );
}

function WineCardSystembolaget({ wine, styles, onOpenSystembolaget }: {
  wine: WineRecord; styles: SharedStyles; onOpenSystembolaget: (productId: string) => void;
}) {
  if (!wine.systembolaget_product_id) return null;
  return (
    <View style={styles.foodSection}>
      <Text style={styles.inputLabel}>Importkoppling</Text>
      <Text style={styles.notesText}>Systembolaget #{wine.systembolaget_product_id}</Text>
      <Pressable onPress={() => onOpenSystembolaget(wine.systembolaget_product_id!)} style={styles.inlineLinkButton}>
        <Text style={styles.linkText}>Öppna produktsida</Text>
      </Pressable>
    </View>
  );
}
