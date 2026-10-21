export type SolidesErrorKind =
  | "unauthorized"
  | "not_found"
  | "validation"
  | "unavailable"
  | "write_not_allowed"
  | "unknown";

/** Erro com mensagem já em pt-BR, pronta para voltar ao chat. */
export class SolidesApiError extends Error {
  constructor(
    readonly kind: SolidesErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SolidesApiError";
  }
}

export const DEFAULT_UNAUTHORIZED_MESSAGE =
  "Token inválido. Reconecte o conector com um Token de API válido.";

/** Extrai a mensagem de um corpo de erro. O formato da Sólides não é documentado. */
function messageFromBody(raw: string): string | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const pick = (value: unknown): string | undefined => {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const parts = value.map(pick).filter((part): part is string => part !== undefined);
      return parts.length ? parts.join("; ") : undefined;
    }
    if (typeof value === "object" && value !== null) {
      const parts = Object.entries(value)
        .map(([key, item]) => {
          const text = pick(item);
          return text ? `${key}: ${text}` : undefined;
        })
        .filter((part): part is string => part !== undefined);
      return parts.length ? parts.join("; ") : undefined;
    }
    return undefined;
  };
  if (typeof parsed === "object" && parsed !== null) {
    const body = parsed as Record<string, unknown>;
    for (const field of ["message", "error", "errors", "erro", "erros"]) {
      const text = pick(body[field]);
      if (text) return text;
    }
    return undefined;
  }
  return pick(parsed);
}

export function mapHttpError(
  status: number,
  rawBody: string,
  unauthorizedMessage: string,
): SolidesApiError {
  if (status === 401) return new SolidesApiError("unauthorized", unauthorizedMessage, status);
  if (status === 404) {
    return new SolidesApiError("not_found", "Registro não encontrado na Sólides.", status);
  }
  if (status === 422) {
    const detail = messageFromBody(rawBody);
    return new SolidesApiError(
      "validation",
      detail
        ? `A Sólides recusou a requisição: ${detail}`
        : "A Sólides recusou a requisição (422), sem detalhes.",
      status,
    );
  }
  if (status >= 500) {
    return new SolidesApiError(
      "unavailable",
      `A Sólides está indisponível no momento (HTTP ${status}). Tente novamente em instantes.`,
      status,
    );
  }
  const detail = messageFromBody(rawBody);
  return new SolidesApiError(
    "unknown",
    `A Sólides respondeu com erro (HTTP ${status})${detail ? `: ${detail}` : "."}`,
    status,
  );
}
