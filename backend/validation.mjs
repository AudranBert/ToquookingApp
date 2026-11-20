export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function text(value, max = 20000) {
  if (typeof value !== "string" || value.length > max)
    throw new HttpError(400, "Invalid text field");
  return value;
}

function image(value) {
  const result = text(value, 8 * 1024 * 1024);
  if (
    result &&
    !/^https?:\/\//i.test(result) &&
    !/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(result)
  )
    throw new HttpError(400, "Unsupported image format");
  return result;
}

export function recipeId(value) {
  const result = text(value, 128);
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(result)) throw new HttpError(400, "Invalid recipe ID");
  return result;
}

/** Explicit allowlist: the database and public links only contain recipe data. */
export function validateRecipe(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new HttpError(400, "Invalid recipe");
  const recipe = {
    id: recipeId(raw.id),
    name: text(raw.name, 500),
    createdAt: text(raw.createdAt, 40),
    updatedAt: text(raw.updatedAt, 40),
  };
  if (
    !recipe.name.trim() ||
    !Number.isFinite(Date.parse(recipe.createdAt)) ||
    !Number.isFinite(Date.parse(recipe.updatedAt))
  )
    throw new HttpError(400, "Invalid recipe metadata");
  for (const field of ["tags", "instructions", "ingredients"]) {
    if (!Array.isArray(raw[field]) || raw[field].length > 1000)
      throw new HttpError(400, "Invalid recipe list");
  }
  recipe.tags = raw.tags.map((value) => text(value, 200));
  recipe.instructions = raw.instructions.map((value) => text(value));
  recipe.ingredients = raw.ingredients.map((value) => {
    if (!value || typeof value !== "object") throw new HttpError(400, "Invalid ingredient");
    const ingredient = { id: recipeId(value.id), name: text(value.name, 1000) };
    for (const field of ["quantity", "unit", "note"])
      if (value[field] != null) ingredient[field] = text(value[field], 2000);
    return ingredient;
  });
  for (const field of ["origin", "notes"]) if (raw[field] != null) recipe[field] = text(raw[field]);
  for (const field of ["sourceUrl", "videoUrl"]) {
    if (raw[field] != null) {
      const value = text(raw[field], 4000);
      if (value && !/^https?:\/\//i.test(value)) throw new HttpError(400, "Invalid source URL");
      recipe[field] = value;
    }
  }
  for (const field of ["prepTime", "restTime", "cookTime", "totalTime"]) {
    if (raw[field] != null) {
      if (typeof raw[field] !== "number" || !Number.isFinite(raw[field]) || raw[field] < 0)
        throw new HttpError(400, "Invalid timing");
      recipe[field] = raw[field];
    }
  }
  if (raw.servings != null) {
    if (typeof raw.servings === "string") recipe.servings = text(raw.servings, 200);
    else if (typeof raw.servings === "number" && Number.isFinite(raw.servings) && raw.servings > 0)
      recipe.servings = raw.servings;
    else throw new HttpError(400, "Invalid servings");
  }
  for (const field of ["imageUrl", "sourceImageUrl"])
    if (raw[field] != null) recipe[field] = image(raw[field]);
  for (const field of ["imageUrls", "sourceImageUrls"]) {
    if (raw[field] == null) continue;
    if (!Array.isArray(raw[field]) || raw[field].length > 30)
      throw new HttpError(400, "Invalid image list");
    recipe[field] = raw[field].map(image);
  }
  if (Buffer.byteLength(JSON.stringify(recipe)) > 12 * 1024 * 1024)
    throw new HttpError(413, "Recipe exceeds 12 MB");
  return recipe;
}

export function validateMutations(body) {
  if (!Array.isArray(body?.mutations) || body.mutations.length < 1 || body.mutations.length > 25)
    throw new HttpError(400, "Invalid batch");
  return body.mutations.map((raw) => {
    if (!raw || !["put", "delete"].includes(raw.operation))
      throw new HttpError(400, "Invalid mutation");
    const mutation = {
      recipeId: recipeId(raw.recipeId),
      revision: recipeId(raw.revision),
      operation: raw.operation,
    };
    if (raw.operation === "put") {
      mutation.recipe = validateRecipe(raw.recipe);
      if (mutation.recipe.id !== mutation.recipeId)
        throw new HttpError(400, "Mismatched recipe ID");
    }
    return mutation;
  });
}
