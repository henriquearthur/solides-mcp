/**
 * `fetch` falso para os testes. Nenhum teste chama a API real da Sólides.
 *
 * Rotas são declaradas como "METODO caminho" (o caminho vem depois do host, sem a
 * query), por exemplo "GET /departamentos/3". Uma resposta pode ser um valor JSON,
 * um `FakeResponse` (status, corpo cru) ou uma função que recebe a requisição.
 */

export interface RecordedRequest {
  method: string;
  /** URL completa, com host e query. */
  url: string;
  /** Host (ex.: "app.solides.com" para a V1, "apigw.solides.com.br" para a V3). */
  host: string;
  /** Caminho depois do prefixo da base do host: V1 "/pt-BR/api/v1" ou V3 "/management" (ex.: "/departamentos"). */
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
}

export interface FakeResponse {
  status: number;
  /** Corpo cru (string). Se omitido, a resposta vem sem corpo. */
  body?: string;
}

export type FakeHandler =
  | unknown
  | FakeResponse
  | ((request: RecordedRequest) => unknown | FakeResponse);

export interface FakeFetch {
  fetch: typeof fetch;
  requests: RecordedRequest[];
}

/** Prefixo de caminho removido por host, para as rotas valerem nos dois hosts da Sólides. */
const BASE_PREFIXES: Record<string, string> = {
  "app.solides.com": "/pt-BR/api/v1",
  "apigw.solides.com.br": "/management",
};

function stripBasePrefix(url: URL): string {
  const prefix = BASE_PREFIXES[url.host];
  return prefix && url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : url.pathname;
}

function isFakeResponse(value: unknown): value is FakeResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    typeof (value as FakeResponse).status === "number"
  );
}

/** Resposta JSON 200 por padrão; `{ status, body }` para controlar status e corpo cru. */
export function createFakeFetch(routes: Record<string, FakeHandler>): FakeFetch {
  const requests: RecordedRequest[] = [];

  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const method = (init?.method ?? "GET").toUpperCase();
    const path = stripBasePrefix(url);
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    const request: RecordedRequest = {
      method,
      url: url.toString(),
      host: url.host,
      path,
      query: Object.fromEntries(url.searchParams),
      headers,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    };
    requests.push(request);

    const key = `${method} ${path}`;
    if (!(key in routes)) {
      return new Response(JSON.stringify({ error: `rota não prevista no teste: ${key}` }), {
        status: 404,
      });
    }
    const handler = routes[key];
    const result = typeof handler === "function" ? handler(request) : handler;
    if (isFakeResponse(result)) {
      return new Response(result.body ?? null, { status: result.status });
    }
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  return { fetch: fakeFetch, requests };
}
