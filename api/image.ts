import { fetchProxiedImage } from "./imageProxyCore";

export default async function handler(
  request: { query: Record<string, unknown> },
  response: {
    status: (code: number) => {
      setHeader: (name: string, value: string) => void;
      send: (body: unknown) => void;
    };
  },
) {
  const url = String(request.query.url ?? "");
  const result = await fetchProxiedImage(url);
  const outgoing = response.status(result.status);
  outgoing.setHeader("content-type", result.contentType);
  outgoing.setHeader("cache-control", "public, max-age=86400");
  outgoing.send(result.body);
}
