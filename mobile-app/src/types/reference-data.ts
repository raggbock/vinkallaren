export type ReferenceOptionRow = {
  id: string;
  name: string;
  category: "grape" | "country" | "region";
  aliases: string[];
  parent_name: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
