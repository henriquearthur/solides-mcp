import { z } from "zod";
import type { SolidesClient } from "../client.js";
import type { ToolContext } from "./context.js";
import { jsonResult } from "./result.js";
import { isoDateInput, isoToApiDate } from "../dates.js";
import { paginate, paginationInput } from "../pagination.js";

/**
 * Teto de páginas percorridas em `GET /curriculos`, abaixo do limite de 50 subrequisições
 * por chamada do plano gratuito do Workers. Local a este módulo até o helper genérico de
 * paginação da API (ticket #8) poder substituí-lo.
 */
export const RESUMES_MAX_PAGES = 40;

/** Forma relevante de `GET /curriculos` (schema `Curriculo`). UNCONFIRMED até o teste de fumaça. */
interface ApiResume {
  id: number;
  fullName?: string;
  idNumber?: string;
  mainEmail?: string;
  mobile?: string;
  phone?: string;
  seniority?: string;
  origin?: string;
}

function summarize(r: ApiResume) {
  return {
    id: r.id,
    fullName: r.fullName ?? null,
    idNumber: r.idNumber ?? null,
    mainEmail: r.mainEmail ?? null,
    mobile: r.mobile ?? null,
    phone: r.phone ?? null,
    seniority: r.seniority ?? null,
    origin: r.origin ?? null,
  };
}

type WalkResult =
  | { kind: "raw"; body: unknown }
  | { kind: "pages"; items: ApiResume[]; incomplete: boolean };

/**
 * Percorre `GET /curriculos?page=N` até uma página vazia (ou sem Currículos novos, caso a
 * API ignore `page`) ou até `RESUMES_MAX_PAGES`. Corpo que não é array é devolvido cru.
 */
async function walkResumePages(
  client: SolidesClient,
  query: Record<string, string | undefined>,
): Promise<WalkResult> {
  const seen = new Set<number>();
  const items: ApiResume[] = [];
  for (let page = 1; page <= RESUMES_MAX_PAGES; page++) {
    const body = await client.get<ApiResume[] | undefined>("/curriculos", {
      query: { ...query, page: String(page) },
    });
    if (!Array.isArray(body)) {
      if (page === 1) return { kind: "raw", body };
      return { kind: "pages", items, incomplete: false };
    }
    const fresh = body.filter((r) => !seen.has(r.id));
    if (fresh.length === 0) return { kind: "pages", items, incomplete: false };
    for (const r of fresh) seen.add(r.id);
    items.push(...fresh);
  }
  return { kind: "pages", items, incomplete: true };
}

export function registerResumeTools({ server, client }: ToolContext): void {
  server.registerTool(
    "get_resumes",
    {
      description:
        "Consulta os Currículos (candidatos do banco de talentos) da Sólides. Sem `id`, lista os Currículos, opcionalmente por intervalo de datas, com um resumo de cada um (id, nome, CPF, e-mail principal, telefones, senioridade e origem), sem foto; paginada e informa o total. Se a Sólides tiver Currículos demais, a lista pode vir incompleta e avisa. Com `id`, devolve o Currículo completo.",
      inputSchema: {
        id: z.number().int().positive().optional().describe("Id do Currículo. Sem ele, lista os Currículos."),
        from: isoDateInput.optional().describe("Currículos a partir desta data (AAAA-MM-DD)."),
        until: isoDateInput.optional().describe("Currículos até esta data (AAAA-MM-DD)."),
        ...paginationInput,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id, from, until, limit, offset }) => {
      if (id !== undefined) return jsonResult(await client.get(`/curriculos/${id}`));
      const walk = await walkResumePages(client, {
        data_inicial: from === undefined ? undefined : isoToApiDate(from),
        data_final: until === undefined ? undefined : isoToApiDate(until),
        ocultar_foto: "SIM",
      });
      if (walk.kind === "raw") return jsonResult(walk.body);
      const page = paginate(walk.items.map(summarize), { limit, offset });
      return jsonResult(
        walk.incomplete
          ? {
              ...page,
              incomplete: true,
              warning: `Resultado incompleto: a lista foi cortada em ${RESUMES_MAX_PAGES} páginas da Sólides. Reduza o intervalo de datas (from e until) para ver o restante.`,
            }
          : { ...page, incomplete: false },
      );
    },
  );
}
