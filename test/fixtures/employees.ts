/**
 * Fixtures de `GET /colaboradores` (forma conforme docs/api/openapi.json, schema `Colaboradores`).
 * O cadastro real tem cerca de 4,5 KB por Colaborador; aqui há campos suficientes para provar
 * que o resumo da lista reduz o registro sem esconder dados.
 */
function employee(overrides: Record<string, unknown>) {
  return {
    email: "colaborador@example.com.br",
    birthDate: "01/01/1987",
    education: "medio_completo",
    course: "Arquitetura e Urbanismo",
    gender: "Feminino",
    ethnicity: "Parda",
    workShift: "Diurno",
    typeContract: "CLT",
    senior: { id: 1, name: "Joana" },
    'updated_at"': "02/01/2019",
    vinculo_externos: [{ id: 10, origin: "tangerino", externalId: "abc-123" }],
    ...overrides,
  };
}

export const maria = employee({
  id: 1,
  name: "Maria de Fátima Souza",
  idNumber: "11223344556",
  registration: "381998",
  dateAdmission: "01/03/2018",
  active: true,
  departament: { id: 1, name: "Tecnologia" },
  position: { id: 7, name: "Analista de Sistemas", minimumWage: 4500, briefDescription: "Analisa", activities: "Várias" },
  unity: { name: "Matriz" },
});

export const jose = employee({
  id: 2,
  name: "José Álvares",
  idNumber: "99887766554",
  registration: "BR-0042",
  dateAdmission: "15/06/2020",
  active: true,
  departament: { id: 2, name: "Recursos Humanos" },
  position: { id: 8, name: "Gerente de RH", minimumWage: 9000, briefDescription: "Gere", activities: "Gestão" },
  unity: { name: "Filial Sul" },
});

export const ana = employee({
  id: 3,
  name: "Ana Paula Ribeiro",
  idNumber: "12345678909",
  registration: "777",
  dateAdmission: "10/01/2015",
  dateDismissal: "30/09/2021",
  reasonDismissal: "Pedido de demissão",
  active: false,
  departament: { id: 1, name: "Tecnologia" },
  position: { id: 9, name: "Desenvolvedora", minimumWage: 6000, briefDescription: "Dev", activities: "Código" },
  unity: { name: "Matriz" },
});

export const activeEmployees = [maria, jose];
export const allEmployees = [maria, jose, ana];

/** Gera `count` Colaboradores ativos para testes de paginação. */
export function manyEmployees(count: number) {
  return Array.from({ length: count }, (_, i) =>
    employee({
      id: 1000 + i,
      name: `Colaborador ${String(i + 1).padStart(3, "0")}`,
      idNumber: String(10000000000 + i),
      registration: `M${i + 1}`,
      dateAdmission: "01/01/2022",
      active: true,
      departament: { id: 1, name: "Tecnologia" },
      position: { id: 7, name: "Analista", minimumWage: 1, briefDescription: "", activities: "" },
      unity: { name: "Matriz" },
    }),
  );
}
