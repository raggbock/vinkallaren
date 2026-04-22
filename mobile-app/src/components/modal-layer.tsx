import { lazy, Suspense } from "react";
import { useCellarActionsContext, useCellarReferenceContext, useCellarStorageContext } from "../contexts/CellarContext";
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
  const { storageSpaces, storageSpaceById, storageSpaceDraft, savingStorageSpace } = useCellarStorageContext();
  const {
    effectiveCountryOptions, effectiveRegionOptions, effectiveGrapeOptions,
    countryReferenceRows, regionReferenceRows, grapeReferenceRows,
  } = useCellarReferenceContext();
  const { searchCatalogWineNames, setStorageSpaceDraft } = useCellarActionsContext();
  const tasting = useTasting();

  return (
    <Suspense fallback={null}>
      <PrivacyPolicyModal visible={privacy.visible} styles={styles} onClose={privacy.close} />
      <CatalogEditorModal
        {...catalogEditor.modalProps} styles={styles}
        searchWineNames={searchCatalogWineNames}
        effectiveCountryOptions={effectiveCountryOptions} effectiveRegionOptions={effectiveRegionOptions}
        effectiveGrapeOptions={effectiveGrapeOptions}
        countryReferenceRows={countryReferenceRows} regionReferenceRows={regionReferenceRows}
        grapeReferenceRows={grapeReferenceRows}
      />
      <WsetTastingModal {...drink.wsetProps} />
      <DrinkWineModal {...drink.modalProps} styles={styles} />
      <WsetTastingModal {...tasting.wsetProps} />
      <EditWineModal
        {...edit.modalProps} styles={styles}
        storageSpaces={storageSpaces}
        storageSpaceById={storageSpaceById}
        searchWineNames={searchCatalogWineNames}
        effectiveCountryOptions={effectiveCountryOptions} effectiveRegionOptions={effectiveRegionOptions}
        effectiveGrapeOptions={effectiveGrapeOptions}
        countryReferenceRows={countryReferenceRows} regionReferenceRows={regionReferenceRows}
        grapeReferenceRows={grapeReferenceRows}
        storageSpaceDraft={storageSpaceDraft} savingStorageSpace={savingStorageSpace}
        onStorageSpaceDraftChange={(patch) => setStorageSpaceDraft((c) => ({ ...c, ...patch }))}
      />
    </Suspense>
  );
}
