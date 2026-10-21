import { z } from "zod";
import type { ToolContext } from "./context.js";
import { jsonResult } from "./result.js";
import { paginate, paginationInput } from "../pagination.js";

/** Forma relevante de `GET /absenteismos` (schema `Absenteismo`); `employee` é o cadastro completo. */
interface ApiAbsence {
  id: number;
  dateTimeAbsenteeism?: string | null;
  type?: string | null;
  location?: string | null;
  tangerinoId?: number | null;
  note?: string | null;
  employee?: { id: number; name?: string | null } | null;
}

function summarize(a: ApiAbsence) {
  return {
    id: a.id,
    dateTimeAbsenteeism: a.dateTimeAbsenteeism ?? null,
    type: a.type ?? null,
    location: a.location ?? null,
    tangerinoId: a.tangerinoId ?? null,
    note: a.note ?? null,
    employee: a.employee ? { id: a.employee.id, name: a.employee.name ?? null } : null,
  };
}

export function registerAbsenceTools({ server, client }: ToolContext): void {
  server.registerTool(
    "get_absences",
    {
      description:
        "Consulta Absenteísmos da Sólides (registros de ausência ou ponto de um Colaborador).",
      inputSchema: { ...paginationInput },
      annotations: { readOnlyHint: true },
    },
    async ({ limit, offset }) => {
      const absences = await client.get<ApiAbsence[] | undefined>("/absenteismos");
      if (!Array.isArray(absences)) return jsonResult(absences);
      return jsonResult(paginate(absences.map(summarize), { limit, offset }));
    },
  );
}
