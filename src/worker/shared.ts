import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { parseAllowWrites } from "../core/index.js";

export interface Env {
  /** Armazenamento do workers-oauth-provider (o nome do binding é fixo). */
  OAUTH_KV: KVNamespace;
  /** Helpers do provider, injetados por ele. */
  OAUTH_PROVIDER: OAuthHelpers;
  /**
   * Teto da instalação para a escrita (ADR 0002): `"true"` libera a caixa "Permitir escrita"
   * na tela de autorização. Ausente ou qualquer outro valor: escrita desligada.
   */
  SOLIDES_ALLOW_WRITES?: string;
}

/** A instalação permite escrita? Mesma regra do stdio (`parseAllowWrites`). */
export function installationAllowsWrites(env: Pick<Env, "SOLIDES_ALLOW_WRITES">): boolean {
  return parseAllowWrites(env.SOLIDES_ALLOW_WRITES);
}

/**
 * Props da Autorização: ficam criptografadas pelo provider e chegam ao /mcp em `ctx.props`.
 * O Token de API não vai para nenhum outro lugar (nem log).
 */
export interface SolidesGrantProps {
  token: string;
  allowWrites: boolean;
}

/** Mensagem do 401 da Sólides nesta entrada. */
export const UNAUTHORIZED_MESSAGE = "token inválido, reconecte o conector";

/**
 * `fetch` do Worker. O `fetch` global não pode ser chamado como método de outro objeto
 * no workerd ("Illegal invocation"), então a chamada passa por esta função.
 */
export const workerFetch: typeof fetch = (input, init) => globalThis.fetch(input, init);
