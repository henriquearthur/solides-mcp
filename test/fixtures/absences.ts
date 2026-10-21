import { jose, maria } from "./employees.js";

/**
 * Fixtures de `GET /absenteismos` (forma conforme docs/api/openapi.json, schema `Absenteismo`):
 * a data vem em `dateTimeAbsenteeism` (`dd/mm/aaaa HH:MM:SS`) e o Colaborador completo em `employee`.
 */
export function absence(overrides: Record<string, unknown>) {
  return {
    type: "Chegada",
    location: "Belo Horizonte",
    tangerinoId: 100,
    note: "Observação do Absenteísmo",
    employee: maria,
    ...overrides,
  };
}

export const mariaArrival = absence({ id: 1, dateTimeAbsenteeism: "11/07/2017 08:30:00" });

export const mariaDeparture = absence({
  id: 2,
  dateTimeAbsenteeism: "11/07/2017 18:05:10",
  type: "Saída",
  tangerinoId: 101,
});

export const joseArrival = absence({
  id: 3,
  dateTimeAbsenteeism: "12/07/2017 09:00:00",
  location: "Porto Alegre",
  tangerinoId: null,
  note: null,
  employee: jose,
});

export const allAbsences = [mariaArrival, mariaDeparture, joseArrival];

export function manyAbsences(n: number) {
  return Array.from({ length: n }, (_, i) =>
    absence({ id: i + 1, dateTimeAbsenteeism: "01/08/2017 08:00:00" }),
  );
}
