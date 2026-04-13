import { lazy, Suspense } from "react";
import { useCellar } from "../contexts/CellarContext";
import { useTasting } from "../contexts/TastingContext";
import { styles } from "../styles/theme";
import type { useDrinkWineModal } from "../hooks/useDrinkWineModal";
import type { useEditWineModal } from "../hooks/useEditWineModal";
import type { useCatalogEditorModal } from "../hooks/useCatalogEditorModal";
import type { useModalToggle } from "../hooks/useModalToggle";

const CatalogEditorModal = lazy(() => import("./cellar-workflows").then(m => ({ default: m.CatalogEditorModal })));
const DrinkWineModal = lazy(() => import("./cellar-workflows").then(m => ({ default: m.DrinkWineModal })));
const EditWineModal = lazy(() => import("./edit-wine-modal").then(m => ({ default: m.EditWineModal })));
const WsetTastingModal = lazy(() => import("./wset-tasting-modal").then(m => ({ default: m.WsetTastingModal })));
const PrivacyPolicyModal = lazy(() => import("./privacy-policy-modal").then(m => ({ default: m.PrivacyPolicyModal })));

type Props = {
  drink: ReturnType<typeof useDrinkWineModal>;
  edit: ReturnType<typeof useEditWineModal>;
  catalogEditor: ReturnType<typeof useCatalogEditorModal>;
  privacy: ReturnType<typeof useModalToggle>;
};

export function ModalLayer({ drink, edit, catalogEditor, privacy }: Props) {
  const ctx = useCellar();
  const tasting = useTasting();

  return (
    <Suspense fallback={null}>
      <PrivacyPolicyModal visible={privacy.visible} styles={styles} onClose={privacy.close} />
      <CatalogEditorModal
        {...catalogEditor.modalProps} styles={styles}
        searchWineNames={ctx.searchCatalogWineNames}
        effectiveCountryOptions={ctx.effectiveCountryOptions} effectiveRegionOptions={ctx.effectiveRegionOptions}
        effectiveGrapeOptions={ctx.effectiveGrapeOptions}
        countryReferenceRows={ctx.countryReferenceRows} regionReferenceRows={ctx.regionReferenceRows}
        grapeReferenceRows={ctx.grapeReferenceRows}
      />
      <WsetTastingModal {...drink.wsetProps} />
      <DrinkWineModal {...drink.modalProps} styles={styles} />
      <WsetTastingModal {...tasting.wsetProps} />
      <EditWineModal
        {...edit.modalProps} styles={styles}
        storageSpaces={ctx.storageSpaces}
        storageSpaceById={ctx.storageSpaceById}
        searchWineNames={ctx.searchCatalogWineNames}
        effectiveCountryOptions={ctx.effectiveCountryOptions} effectiveRegionOptions={ctx.effectiveRegionOptions}
        effectiveGrapeOptions={ctx.effectiveGrapeOptions}
        countryReferenceRows={ctx.countryReferenceRows} regionReferenceRows={ctx.regionReferenceRows}
        grapeReferenceRows={ctx.grapeReferenceRows}
        storageSpaceDraft={ctx.storageSpaceDraft} savingStorageSpace={ctx.savingStorageSpace}
        onStorageSpaceDraftChange={(patch) => ctx.setStorageSpaceDraft((c) => ({ ...c, ...patch }))}
      />
    </Suspense>
  );
}
