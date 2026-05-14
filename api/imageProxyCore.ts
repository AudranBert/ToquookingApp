export async function fetchProxiedImage(url: string) {
  if (!/^https?:\/\//.test(url)) {
    return { status: 400, contentType: "text/plain; charset=utf-8", body: "Invalid image URL" };
  }

  const image = await fetch(url, {
    headers: {
      "user-agent": "ToqueRecipeHub/0.1 (+image export proxy)",
      accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    },
  });

  return {
    status: image.status,
    contentType: image.headers.get("content-type") ?? "application/octet-stream",
    body: image.body,
  };
}
