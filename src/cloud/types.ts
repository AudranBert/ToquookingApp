import type { Recipe } from "../types";

export type CloudMutation = {
  target: string;
  recipeId: string;
  revision: string;
  operation: "put" | "delete";
  recipe?: Recipe;
  manual?: boolean;
};

export type CloudHealth = { server: boolean; database: boolean };

export type CloudTrashEntry = {
  id: string;
  name: string;
  deletedAt: string;
  expiresAt: string;
};
