/**
 * Fixtures de `GET /curriculos` (forma do docs/api/openapi.json, schema `Curriculo`).
 * UNCONFIRMED: o formato real da lista e a paginação dependem do teste de fumaça (`npm run smoke`).
 */
export function resume(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    fullName: "Maria de Fátima Souza",
    mainEmail: "maria@example.com.br",
    secondaryEmail: "maria.souza@example.com.br",
    idNumber: "01234567890",
    gender: "Feminino",
    phone: "(31) 33333333",
    mobile: "(31) 999999999",
    birthDate: "01/01/1987",
    maritalStatus: "Solteira",
    seniority: "Trainee",
    linkedin: "https://www.linkedin.com/maria",
    origin: "Banco de talentos",
    adress: { city: "Belo Horizonte", state: "MG" },
    languages: [{ name: "Inglês", level: "Avançado" }],
    notes: [{ text: "Entrevistada em março" }],
    professionalExperiences: [{ company: "Acme", position: "Analista" }],
    academicEducations: [{ institution: "UFMG", course: "Administração" }],
    ...overrides,
  };
}

export const resumeMaria = resume();
export const resumeJoao = resume({
  id: 2,
  fullName: "João Pereira",
  mainEmail: "joao@example.com.br",
  idNumber: "98765432100",
  mobile: "(11) 988887777",
});

/** Currículos com ids de `from` a `from + count - 1`. */
export function resumes(from: number, count: number) {
  return Array.from({ length: count }, (_, i) =>
    resume({ id: from + i, fullName: `Candidato ${from + i}` }),
  );
}
