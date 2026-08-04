export type JsonReadResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 413 | 415; error: string };

export function sameOriginMutation(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function readLimitedJson<T = unknown>(
  request: Request,
  maxBytes: number,
): Promise<JsonReadResult<T>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return { ok: false, status: 415, error: "Content-Type must be application/json." };
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { ok: false, status: 413, error: "Request body is too large." };
  }

  if (!request.body) return { ok: false, status: 400, error: "Request body must be valid JSON." };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return { ok: false, status: 413, error: "Request body is too large." };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) as T };
  } catch {
    return { ok: false, status: 400, error: "Request body must be valid JSON." };
  }
}
