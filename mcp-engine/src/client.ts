export interface ClientOk {
  ok: true;
  status: number;
  data: unknown;
}
export interface ClientErr {
  ok: false;
  status: number;
  code?: string;
  message: string;
}
export type ClientResult = ClientOk | ClientErr;

interface FetchResponse {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}
export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<FetchResponse>;

export function buildUrl(baseUrl: string, path: string, query?: Record<string, unknown>): string {
  const base = baseUrl.replace(/\/+$/, "");
  const url = new URL(base + path);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

export function normalizeError(status: number, body: unknown): ClientErr {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const baseMessage =
      (typeof b.message === "string" && b.message) ||
      (typeof b.error === "string" && b.error) ||
      `HTTP ${status}`;
    const code = typeof b.code === "string" ? b.code : undefined;
    let message = baseMessage;
    if (Array.isArray(b.availablePairs) && b.availablePairs.length) {
      message += ` (available pairs: ${(b.availablePairs as unknown[]).join(", ")})`;
    }
    return { ok: false, status, code, message };
  }
  return { ok: false, status, message: `HTTP ${status}` };
}

export class TrendiqClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(baseUrl: string, opts: { fetchImpl?: FetchLike; timeoutMs?: number } = {}) {
    this.baseUrl = baseUrl;
    this.fetchImpl = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    this.timeoutMs = opts.timeoutMs ?? 20000;
  }

  async get(path: string, query?: Record<string, unknown>): Promise<ClientResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const url = buildUrl(this.baseUrl, path, query);
      const res = await this.fetchImpl(url, { signal: controller.signal });
      const text = await res.text();
      let body: unknown = undefined;
      try {
        body = text ? JSON.parse(text) : undefined;
      } catch {
        body = text;
      }
      if (!res.ok) return normalizeError(res.status, body);
      return { ok: true, status: res.status, data: body };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, status: 0, message: `Request failed: ${message}` };
    } finally {
      clearTimeout(timer);
    }
  }
}
