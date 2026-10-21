import type { ConsentDescription } from "@cloudflare/workers-oauth-provider";

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Tudo que vem do cliente (nome, host) é escolhido por quem se registrou: sempre escapar. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

export interface AuthorizePageInput {
  details: ConsentDescription;
  /** Handle de uso único da tela, preso ao navegador por cookie. */
  handle: string;
  /** Erro da tentativa anterior, em pt-BR. */
  error?: string;
  /** A instalação permite escrita (teto): só então a caixa "Permitir escrita" é renderizada. */
  offerWrites?: boolean;
}

/**
 * Tela de autorização. Pede o Token de API da Empresa.
 * O token digitado nunca é reexibido: ao errar, o campo volta vazio.
 */
export function renderAuthorizePage({ details, handle, error, offerWrites = false }: AuthorizePageInput): string {
  const client = escapeHtml(details.clientName);
  const host = escapeHtml(details.redirectHost);
  const loopback = details.redirectIsLoopback
    ? `<p class="aviso"><strong>Este acesso será enviado a um aplicativo no seu computador.</strong> Continue só se você acabou de iniciar a conexão por ele.</p>`
    : "";
  const writesBlock = offerWrites
    ? `
  <label class="opcao"><input type="checkbox" name="allowWrites"> Permitir escrita (registrar e excluir Ocorrências)</label>
  <small>Desmarcada, o chat só consulta a Sólides. Para mudar a escolha depois, reconecte o conector.</small>`
    : "";
  const errorBlock = error ? `<p class="erro" role="alert">${escapeHtml(error)}</p>` : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Conectar à Sólides</title>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; max-width: 30rem; margin: 3rem auto; padding: 0 1rem; color: #1a1a1a; }
  label { display: block; font-weight: 600; margin-top: 1.25rem; }
  input[type=password] { width: 100%; box-sizing: border-box; padding: .6rem; margin-top: .4rem; font: inherit; }
  button { font: inherit; padding: .6rem 1.1rem; margin: 1.25rem .5rem 0 0; cursor: pointer; }
  .erro { color: #a40000; background: #fdecec; padding: .6rem .8rem; border-radius: .3rem; }
  .aviso { background: #fff6e0; padding: .6rem .8rem; border-radius: .3rem; }
  label.opcao { font-weight: normal; }
  small { color: #555; }
</style>
</head>
<body>
<h1>Conectar à Sólides</h1>
<p><strong>${client}</strong> quer consultar os dados da Sólides Gestão da sua Empresa. O acesso será enviado a <strong>${host}</strong>.</p>
${loopback}
${errorBlock}
<form method="post">
  <input type="hidden" name="handle" value="${escapeHtml(handle)}">
  <label for="token">Token de API da Sólides</label>
  <input id="token" name="token" type="password" autocomplete="off" required autofocus>
  <small>Gere o token nas configurações da Sólides Gestão. Ele fica guardado só nesta Autorização, criptografado.</small>
  ${writesBlock}
  <div>
    <button type="submit" name="decision" value="approve">Autorizar</button>
    <button type="submit" name="decision" value="deny" formnovalidate>Negar</button>
  </div>
</form>
</body>
</html>`;
}
