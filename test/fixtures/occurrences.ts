/**
 * Fixtures de `GET /ocorrencias` (forma conforme docs/api/openapi.json, schema `Ocorrencia`).
 * A API real traz campos além dos documentados (cerca de 3 KB por registro); `extras` simula isso
 * para provar que a lista só devolve os campos documentados.
 */
export interface FixtureOccurrence {
  id: number;
  incidentDate: string;
  classification: string;
  comment: string;
  value: number | string | null;
  typeIncident: string;
  colaborador: { id: number; nome: string };
  [extra: string]: unknown;
}

const extras = {
  createdAt: "2024-01-01T10:00:00.000-03:00",
  author: { id: 99, name: "Gestora", idNumber: "00011122233" },
  attachments: [{ id: 1, url: "https://example.com/a.pdf" }],
};

interface OccurrenceInput {
  id: number;
  incidentDate: string;
  classification: string;
  comment: string;
  value?: number | string | null;
  typeIncident: string;
  colaborador: { id: number; nome: string };
}

function occurrence(o: OccurrenceInput): FixtureOccurrence {
  return { value: null, ...extras, ...o };
}

export const feedbackMaria = occurrence({
  id: 101,
  incidentDate: "15/03/2024",
  classification: "Positivo",
  comment: "Ótima condução da reunião.",
  typeIncident: "Feedback",
  colaborador: { id: 1, nome: "Maria de Fátima Souza" },
});

export const atrasoMaria = occurrence({
  id: 102,
  incidentDate: "02/04/2024",
  classification: "Negativo",
  comment: "Chegou 20 minutos atrasada.",
  value: 12.9,
  typeIncident: "Atraso",
  colaborador: { id: 1, nome: "Maria de Fátima Souza" },
});

export const feedbackJose = occurrence({
  id: 103,
  incidentDate: "10/09/2024",
  classification: "Negativo",
  comment: "Precisa melhorar a documentação.",
  typeIncident: "Feedback",
  colaborador: { id: 2, nome: "José Álvares" },
});

export const promocaoJose = occurrence({
  id: 104,
  incidentDate: "01/01/2023",
  classification: "Positivo",
  comment: "Promovido a gerente.",
  typeIncident: "Promoção",
  colaborador: { id: 2, nome: "José Álvares" },
});

export const allOccurrences = [feedbackMaria, atrasoMaria, feedbackJose, promocaoJose];

/** `n` Ocorrências de Atraso com ids 1..n, para paginação. */
export function manyOccurrences(n: number): FixtureOccurrence[] {
  return Array.from({ length: n }, (_, i) =>
    occurrence({
      id: i + 1,
      incidentDate: "05/05/2024",
      classification: "Negativo",
      comment: `Atraso ${i + 1}`,
      typeIncident: "Atraso",
      colaborador: { id: 1, nome: "Maria de Fátima Souza" },
    }),
  );
}
