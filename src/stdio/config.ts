import type { SolidesServerConfig } from "../core/index.js";

export class StdioConfigError extends Error {}

/** Monta a configuração do núcleo a partir do ambiente (`process.env`). */
export function readStdioConfig(
  env: Record<string, string | undefined>,
): Pick<SolidesServerConfig, "token" | "allowWrites" | "unauthorizedMessage"> {
  const token = env.SOLIDES_API_TOKEN?.trim();
  if (!token) {
    throw new StdioConfigError(
      "A variável de ambiente SOLIDES_API_TOKEN não está definida. " +
        "Gere um Token de API nas configurações da Sólides Gestão e informe-o em SOLIDES_API_TOKEN.",
    );
  }
  return {
    token,
    allowWrites: env.SOLIDES_ALLOW_WRITES?.trim().toLowerCase() === "true",
    unauthorizedMessage:
      "Token inválido. Verifique o valor de SOLIDES_API_TOKEN (Token de API da Sólides Gestão).",
  };
}
