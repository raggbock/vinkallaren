import { useState, useMemo } from "react";
import { useCellar } from "../contexts/CellarContext";
import { MealPlannerPanel } from "./cellar-sections";
import { buildMealRecommendations } from "../lib/cellar-helpers";
import { styles } from "../styles/theme";

type Props = {
  hidden: boolean;
  onWinePress: (wineId: string) => void;
  onOpenProfile: () => void;
};

export function MealTab({ hidden, onWinePress, onOpenProfile }: Props) {
  const { wines } = useCellar();
  const [selectedMeal, setSelectedMeal] = useState("lamm");
  const mealRecommendations = useMemo(
    () => buildMealRecommendations(wines, selectedMeal),
    [selectedMeal, wines],
  );

  if (hidden) return null;

  return (
    <MealPlannerPanel
      styles={styles}
      wines={wines}
      selectedMeal={selectedMeal}
      mealRecommendations={mealRecommendations}
      onSelectMeal={setSelectedMeal}
      onWinePress={(wine) => onWinePress(wine.id)}
      onOpenProfile={onOpenProfile}
    />
  );
}
