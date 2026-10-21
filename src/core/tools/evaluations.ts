import { z } from "zod";
import type { ToolContext } from "./context.js";
import { jsonResult, pagedResult } from "./result.js";
import { isoDateInput, isoToApiDate } from "../dates.js";
import { paginate, paginationInput } from "../pagination.js";
import { digitsOnly, includesText } from "../text.js";
import { getAllV3Pages } from "../v3.js";

const V1_EVALUATION_PATHS = {
  performance: "/avaliacao_desempenhos",
  advanced: "/avaliacao_avancadas",
} as const;

const CYCLES_PATH = "/evaluation/external_api/solicitations";

/** Item da V3: `{ id, type, attributes }`. */
interface V3Resource {
  id?: number | string;
  attributes?: Record<string, unknown>;
}

/** Achata o item V3 mantendo os nomes de campo da API. */
function flatten(resource: V3Resource) {
  return { id: resource.id ?? null, ...resource.attributes };
}

export function registerEvaluationTools({ server, client }: ToolContext): void {
  server.registerTool(
    "get_evaluations",
    {
      description:
        "Consulta Avaliações de desempenho da Sólides (V1) feitas num intervalo de datas: `type` `performance` (desempenho) ou `advanced` (avançada). Traz avaliador, avaliado, Cargo, Departamento e critérios. Lista paginada (informa o total). Para os ciclos de Avaliação V3, use `get_evaluation_cycles`.",
      inputSchema: {
        type: z
          .enum(["performance", "advanced"])
          .describe("Tipo da avaliação: `performance` (desempenho) ou `advanced` (avançada)."),
        from: isoDateInput.describe("Início do intervalo (AAAA-MM-DD)."),
        to: isoDateInput.describe("Fim do intervalo (AAAA-MM-DD)."),
        ...paginationInput,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ type, from, to, limit, offset }) => {
      const evaluations = await client.get<unknown>(V1_EVALUATION_PATHS[type], {
        query: { data_inicial: isoToApiDate(from), data_final: isoToApiDate(to) },
      });
      if (!Array.isArray(evaluations)) return jsonResult(evaluations);
      return jsonResult(paginate(evaluations, { limit, offset }));
    },
  );

  server.registerTool(
    "get_evaluation_cycles",
    {
      description:
        "Consulta as Avaliações de desempenho V3 da Sólides. Sem `cycle_id`, lista os ciclos (id, nome, datas e situação): comece sempre por aqui. Com `cycle_id`, lista as avaliações daquele ciclo (notas, critérios e comentários), com filtro opcional por Colaborador (`name` ou `cpf`). Consulta um ciclo por vez: para vários ciclos, chame a tool uma vez para cada. Listas paginadas (informam o total).",
      inputSchema: {
        cycle_id: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Id do ciclo, obtido na lista de ciclos. Sem ele, a tool lista os ciclos."),
        name: z
          .string()
          .optional()
          .describe("Só com `cycle_id`: trecho do nome do Colaborador avaliado, sem diferenciar acentos nem maiúsculas."),
        cpf: z
          .string()
          .optional()
          .describe("Só com `cycle_id`: CPF do Colaborador avaliado, com ou sem pontos e traço."),
        ...paginationInput,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ cycle_id, name, cpf, limit, offset }) => {
      if (cycle_id === undefined) {
        if (name !== undefined || cpf !== undefined) {
          throw new Error(
            "Para filtrar por Colaborador, informe o `cycle_id` do ciclo. Liste os ciclos primeiro, sem filtros.",
          );
        }
        const cycles = await getAllV3Pages<V3Resource>(client, CYCLES_PATH);
        return pagedResult(cycles.items.map(flatten), cycles.incomplete, { limit, offset });
      }

      const evaluations = await getAllV3Pages<V3Resource>(client, `${CYCLES_PATH}/${cycle_id}/evaluations`);
      const matches = evaluations.items.map(flatten).filter((evaluation) => {
        const rated = evaluation as { ratedName?: unknown; ratedDocument?: unknown };
        const ratedName = typeof rated.ratedName === "string" ? rated.ratedName : undefined;
        const ratedDocument = rated.ratedDocument === undefined ? "" : String(rated.ratedDocument);
        return (
          (name === undefined || includesText(ratedName, name)) &&
          (cpf === undefined || digitsOnly(ratedDocument) === digitsOnly(cpf))
        );
      });
      return pagedResult(matches, evaluations.incomplete, { limit, offset });
    },
  );
}
