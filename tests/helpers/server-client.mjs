import { Readable } from "node:stream";

/** Exercise the real HTTP handler without requiring a loopback network permission. */
export async function serverClient(t, server) {
  if (process.env.TEST_HTTP === "1") {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    return (path, init) => fetch(base + path, init);
  }
  return (path, { method = "GET", headers = {}, body } = {}) =>
    new Promise((resolve) => {
      const request = Readable.from(body ? [Buffer.from(body)] : []);
      request.method = method;
      request.url = path;
      request.headers = Object.fromEntries(new Headers(headers));
      request.socket = { remoteAddress: "127.0.0.1" };
      const responseHeaders = new Headers();
      let status = 200;
      server.emit("request", request, {
        setHeader: (name, value) => responseHeaders.set(name, value),
        writeHead: (value) => {
          status = value;
        },
        end: (value) =>
          resolve(
            new Response(status === 204 ? null : value, { status, headers: responseHeaders })
          ),
      });
    });
}
