import { z } from "zod";
import type { ToolContext } from "./context.js";
import { jsonResult } from "./result.js";
import { paginate, paginationInput } from "../pagination.js";
import { includesText } from "../text.js";

/** Tipos de dado de referência e o endpoint de lista de cada um. */
const REFERENCE_PATHS = {
  cbo: "/cbos",
  contract_types: "/tipo_contratos",
  dismissal_reasons: "/motivo_demissoes",
} as const;

export function registerPositionTools({ server, client }: ToolContext): void {
  server.registerTool(
    "get_positions",
    {
      description:
        "Consulta os Cargos da Sólides (nome, piso salarial, descrição e atividades). Sem `id`, lista os Cargos, paginados (informa o total); com `id`, detalha um Cargo.",
      inputSchema: {
        id: z.number().int().positive().optional().describe("Id do Cargo a detalhar."),
        ...paginationInput,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id, limit, offset }) => {
      if (id !== undefined) return jsonResult(await client.get(`/cargos/${id}`));
      const positions = await client.get<unknown>("/cargos");
      if (!Array.isArray(positions)) return jsonResult(positions);
      return jsonResult(paginate(positions, { limit, offset }));
    },
  );

  server.registerTool(
    "get_reference_data",
    {
      description:
        "Consulta dados de referência da Sólides que ajudam a ler os cadastros, conforme `kind`: CBO (`cbo`), tipos de contrato (`contract_types`) ou motivos de demissão (`dismissal_reasons`). Lista paginada (informa o total); só os motivos de demissão aceitam `id` para detalhar um.",
      inputSchema: {
        kind: z
          .enum(["cbo", "contract_types", "dismissal_reasons"])
          .describe("Tipo de dado: `cbo`, `contract_types` (tipos de contrato) ou `dismissal_reasons` (motivos de demissão)."),
        id: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Id do motivo de demissão a detalhar. Só vale para `dismissal_reasons`."),
        search: z
          .string()
          .optional()
          .describe("Trecho do texto (ou do código do CBO), sem diferenciar acentos nem maiúsculas."),
        ...paginationInput,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ kind, id, search, limit, offset }) => {
      const path = REFERENCE_PATHS[kind];
      if (id !== undefined) {
        if (kind !== "dismissal_reasons") {
          throw new Error("Só os motivos de demissão (`dismissal_reasons`) podem ser detalhados por `id`.");
        }
        return jsonResult(await client.get(`${path}/${id}`));
      }
      const items = await client.get<unknown>(path);
      if (!Array.isArray(items)) return jsonResult(items);
      const matches =
        search === undefined
          ? items
          : items.filter((item) =>
              Object.values(item as Record<string, unknown>).some(
                (value) => typeof value === "string" && includesText(value, search),
              ),
            );
      return jsonResult(paginate(matches, { limit, offset }));
    },
  );
}
