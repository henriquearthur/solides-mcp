import { z } from "zod";
import type { ToolContext } from "./context.js";
import { jsonResult } from "./result.js";
import { isoDateInput, isoToApiDate } from "../dates.js";
import { paginate, paginationInput } from "../pagination.js";
import { digitsOnly, includesText, normalizeText } from "../text.js";

interface NamedRef {
  name?: string;
}

/** Forma relevante de `GET /colaboradores` (a API grafa `departament`). */
interface ApiEmployee {
  id: number;
  name?: string;
  idNumber?: string;
  registration?: string;
  active?: boolean;
  dateAdmission?: string;
  departament?: NamedRef | null;
  position?: NamedRef | null;
  unity?: NamedRef | null;
}

function summarize(e: ApiEmployee) {
  return {
    id: e.id,
    name: e.name ?? null,
    idNumber: e.idNumber ?? null,
    registration: e.registration ?? null,
    department: e.departament?.name ?? null,
    position: e.position?.name ?? null,
    unity: e.unity?.name ?? null,
    active: e.active ?? null,
    dateAdmission: e.dateAdmission ?? null,
  };
}

export function registerEmployeeTools({ server, client }: ToolContext): void {
  server.registerTool(
    "list_employees",
    {
      description:
        "Lista os Colaboradores da Sólides com um resumo de cada um (id, nome, CPF, Matrícula, Departamento, Cargo, Unidade, se está ativo e data de admissão). Paginada: informa o total depois dos filtros.",
      inputSchema: {
        name: z.string().optional().describe("Trecho do nome, sem diferenciar acentos nem maiúsculas."),
        cpf: z.string().optional().describe("CPF completo, com ou sem pontos e traço."),
        registration: z.string().optional().describe("Matrícula exata do Colaborador."),
        department: z.string().optional().describe("Trecho do nome do Departamento."),
        position: z.string().optional().describe("Trecho do nome do Cargo."),
        unity: z.string().optional().describe("Trecho do nome da Unidade."),
        include_dismissed: z
          .boolean()
          .optional()
          .describe("Incluir Colaboradores demitidos. Sem isso, só vêm os ativos."),
        admitted_from: isoDateInput.optional().describe("Admitidos a partir desta data (AAAA-MM-DD)."),
        admitted_until: isoDateInput.optional().describe("Admitidos antes desta data (AAAA-MM-DD)."),
        ...paginationInput,
      },
      annotations: { readOnlyHint: true },
    },
    async ({
      name,
      cpf,
      registration,
      department,
      position,
      unity,
      include_dismissed,
      admitted_from,
      admitted_until,
      limit,
      offset,
    }) => {
      const employees = await client.get<ApiEmployee[]>("/colaboradores", {
        query: {
          status: include_dismissed ? "todos" : undefined,
          data_admissao: admitted_from === undefined ? undefined : isoToApiDate(admitted_from),
          data_admissao_anterior: admitted_until === undefined ? undefined : isoToApiDate(admitted_until),
        },
      });
      const matches = employees.filter(
        (e) =>
          (name === undefined || includesText(e.name, name)) &&
          (cpf === undefined || digitsOnly(e.idNumber ?? "") === digitsOnly(cpf)) &&
          (registration === undefined ||
            normalizeText(e.registration ?? "") === normalizeText(registration)) &&
          (department === undefined || includesText(e.departament?.name, department)) &&
          (position === undefined || includesText(e.position?.name, position)) &&
          (unity === undefined || includesText(e.unity?.name, unity)),
      );
      return jsonResult(paginate(matches.map(summarize), { limit, offset }));
    },
  );
}
