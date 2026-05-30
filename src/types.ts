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
  origin?: string;
  ingredients: Ingredient[];
  instructions: string[];
  sourceUrl?: string;
  videoUrl?: string;
  servings?: number;
  prepTime?: number;
  restTime?: number;
  cookTime?: number;
  totalTime?: number;
  notes?: string;
  imageUrl?: string;
  imageUrls?: string[];
  sourceImageUrl?: string;
  sourceImageUrls?: string[];
  createdAt: string;
  updatedAt: string;
};

export type RecipeTag = {
  id: string;
  name: string;
  category?: string;
  color?: string;
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
  tags?: Array<Pick<RecipeTag, "name" | "category" | "color">>;
  recipes: Recipe[];
};

export type ShoppingItem = {
  id: string;
  label: string;
  checked: boolean;
  recipeIds: string[];
  pantry?: boolean;
};

export type Panel = "library" | "form" | "shopping" | "backup" | "management";
export type SeasonalThreshold = 0 | 1 | 3;
export type ReimportMode = "replace" | "fill-blanks";
export type RegimeFilter = "" | "omnivore" | "végétarien" | "végétalien" | "pescétarien";
