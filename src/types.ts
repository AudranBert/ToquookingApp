export type Ingredient = {
  id: string;
  name: string;
  quantity?: string;
  unit?: string;
  note?: string;
};

export type Recipe = {
  id: string;
  name: string;
  tags: string[];
  ingredients: Ingredient[];
  instructions: string[];
  sourceUrl?: string;
  videoUrl?: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  totalTime?: number;
  notes?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type RecipeDraft = Omit<Recipe, "id" | "createdAt" | "updatedAt">;

export type ParsedRecipe = Partial<RecipeDraft> & {
  warnings?: string[];
};

export type BackupFile = {
  version: 1;
  exportedAt: string;
  recipes: Recipe[];
};

export type ShoppingItem = {
  id: string;
  label: string;
  checked: boolean;
  recipeIds: string[];
};
