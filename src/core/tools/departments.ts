import { z } from "zod";
import type { ToolContext } from "./context.js";
import { jsonResult } from "./result.js";
import { paginate, paginationInput } from "../pagination.js";

export function registerDepartmentTools({ server, client }: ToolContext): void {
  server.registerTool(
    "get_departments",
    {
      description:
        "Consulta os Departamentos da Empresa na Sólides. Sem `id`, lista os Departamentos, paginados (informa o total); com `id`, detalha um Departamento.",
      inputSchema: {
        id: z.number().int().positive().optional().describe("Id do Departamento a detalhar."),
        ...paginationInput,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id, limit, offset }) => {
      if (id !== undefined) return jsonResult(await client.get(`/departamentos/${id}`));
      const departments = await client.get<unknown>("/departamentos");
      if (!Array.isArray(departments)) return jsonResult(departments);
      return jsonResult(paginate(departments, { limit, offset }));
    },
  );
}
