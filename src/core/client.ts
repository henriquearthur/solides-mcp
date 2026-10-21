import {
  DEFAULT_UNAUTHORIZED_MESSAGE,
  SolidesApiError,
  mapHttpError,
} from "./errors.js";

export const SOLIDES_V1_BASE_URL = "https://app.solides.com/pt-BR/api/v1";

export interface SolidesClientConfig {
  /** Token de API da Empresa. */
  token: string;
  /** Quando false, qualquer método diferente de GET é recusado antes da requisição. */
  allowWrites: boolean;
  fetch: typeof fetch;
  /** Mensagem do 401; muda conforme a entrada (stdio cita SOLIDES_API_TOKEN). */
  unauthorizedMessage?: string | undefined;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

/**
 * Cliente da API Gestão V1 da Sólides. Falhas viram `SolidesApiError` com mensagem
 * em pt-BR; as tools não precisam interpretar status HTTP.
 */
export class SolidesClient {
  constructor(private readonly config: SolidesClientConfig) {}

  get<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("GET", path, options);
  }

  async request<T = unknown>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const verb = method.toUpperCase();
    if (verb !== "GET" && !this.config.allowWrites) {
      throw new SolidesApiError(
        "write_not_allowed",
        "A escrita não está permitida nesta conexão com a Sólides.",
      );
    }

    const url = new URL(SOLIDES_V1_BASE_URL + path);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    let response: Response;
    try {
      response = await this.config.fetch(url, {
        method: verb,
        headers: {
          Authorization: `Token token=${this.config.token}`,
          Accept: "application/json",
          ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch {
      throw new SolidesApiError(
        "unavailable",
        "Não foi possível conectar à Sólides. Verifique a conexão e tente novamente.",
      );
    }

    const raw = await response.text().catch(() => "");
    if (!response.ok) {
      throw mapHttpError(
        response.status,
        raw,
        this.config.unauthorizedMessage ?? DEFAULT_UNAUTHORIZED_MESSAGE,
      );
    }
    if (!raw.trim()) return undefined as T;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  }
}
