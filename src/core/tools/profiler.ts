import { z } from "zod";
import type { ToolContext } from "./context.js";
import { jsonResult } from "./result.js";
import { paginate, paginationInput } from "../pagination.js";

export function registerProfilerTools({ server, client }: ToolContext): void {
  server.registerTool(
    "get_profiler",
    {
      description:
        "Consulta o Profiler (resultado do teste comportamental) dos Colaboradores da Sólides. Sem `id`, lista o Profiler de todos os Colaboradores, ativos e inativos (paginado). Com `id` (o id do Colaborador), devolve o Profiler dele.",
      inputSchema: {
        id: z.number().int().positive().optional().describe("Id do Colaborador. Sem ele, lista todos."),
        ...paginationInput,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id, limit, offset }) => {
      if (id !== undefined) return jsonResult(await client.get(`/profiler/${id}`));
      const profilers = await client.get<unknown[] | undefined>("/profiler");
      if (!Array.isArray(profilers)) return jsonResult(profilers);
      return jsonResult(paginate(profilers, { limit, offset }));
    },
  );

  server.registerTool(
    "get_passports",
    {
      description:
        "Consulta os Passaportes da Sólides (convites para o teste Profiler). Sem `id`, lista os Passaportes (paginado). Com `id`, detalha um Passaporte. Com `id` e `report_option`, devolve o link do relatório Profiler do Passaporte respondido. Opções de relatório: Simples 1, Regular 2, Estendido 3, Coaching 4, Feedback 5.",
      inputSchema: {
        id: z.number().int().positive().optional().describe("Id do Passaporte. Sem ele, lista todos."),
        report_option: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe("Tipo de relatório Profiler: Simples 1, Regular 2, Estendido 3, Coaching 4, Feedback 5. Exige `id`."),
        ...paginationInput,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id, report_option, limit, offset }) => {
      if (report_option !== undefined) {
        if (id === undefined) {
          throw new Error("Informe o `id` do Passaporte para obter o relatório Profiler.");
        }
        return jsonResult(await client.get(`/candidatos/${id}/relatorio/${report_option}`));
      }
      if (id !== undefined) return jsonResult(await client.get(`/candidatos/${id}`));
      const passports = await client.get<unknown[] | undefined>("/candidatos");
      if (!Array.isArray(passports)) return jsonResult(passports);
      return jsonResult(paginate(passports, { limit, offset }));
    },
  );
}
