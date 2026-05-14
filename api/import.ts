import { importRecipeFromSourceUrl } from "./recipeImportCore";

export default async function handler(
  request: { query: Record<string, unknown> },
  response: { status: (code: number) => { json: (body: unknown) => void } },
) {
  const url = String(request.query.url ?? "");
  const result = await importRecipeFromSourceUrl(url);
  response.status(url ? 200 : 400).json(result);
}
