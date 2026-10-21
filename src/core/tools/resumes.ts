import { z } from "zod";
import type { ToolContext } from "./context.js";
import { jsonResult, pagedResult } from "./result.js";
import { isoDateInput, isoToApiDate } from "../dates.js";
import { walkPages } from "../pages.js";
import { paginationInput } from "../pagination.js";

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

export function registerResumeTools({ server, client }: ToolContext): void {
  server.registerTool(
    "get_resumes",
    {
      description:
        "Consulta os Currículos do banco de talentos da Sólides. Sem `id`, lista os Currículos, opcionalmente por intervalo de datas, com um resumo de cada um (id, nome, CPF, e-mail principal, telefones, senioridade e origem), sem foto; paginada e informa o total. Se a Sólides tiver Currículos demais, a lista pode vir incompleta e avisa. Com `id`, devolve o Currículo completo.",
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
      const query = {
        data_inicial: from === undefined ? undefined : isoToApiDate(from),
        data_final: until === undefined ? undefined : isoToApiDate(until),
        ocultar_foto: "SIM",
      };
      // Percorre `GET /curriculos?page=N` até uma página vazia ou sem Currículos novos (caso a API
      // ignore `page` e repita a mesma página). Corpo que não é array vira o resultado cru.
      const seen = new Set<number>();
      let raw: { body: unknown } | undefined;
      const walk = await walkPages({
        fetchPage: async (page) => {
          const body = await client.get<ApiResume[] | undefined>("/curriculos", {
            query: { ...query, page: String(page) },
          });
          if (!Array.isArray(body)) {
            if (page === 1) raw = { body };
            return [];
          }
          const fresh = body.filter((r) => !seen.has(r.id));
          for (const r of fresh) seen.add(r.id);
          return fresh;
        },
        getItems: (fresh) => fresh,
        hasNext: (fresh) => fresh.length > 0,
      });
      if (raw) return jsonResult(raw.body);
      return pagedResult(walk.items.map(summarize), walk.incomplete, { limit, offset });
    },
  );
}
