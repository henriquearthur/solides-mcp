import { z } from "zod";
import type { ToolContext } from "./context.js";
import { jsonResult } from "./result.js";

export function registerDepartmentTools({ server, client }: ToolContext): void {
  server.registerTool(
    "get_departments",
    {
      description:
        "Consulta os Departamentos da Empresa na Sólides. Sem `id`, lista todos os Departamentos; com `id`, detalha um Departamento.",
      inputSchema: {
        id: z.number().int().positive().optional().describe("Id do Departamento a detalhar."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) =>
      jsonResult(await client.get(id === undefined ? "/departamentos" : `/departamentos/${id}`)),
  );
}
