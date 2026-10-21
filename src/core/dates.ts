import { z } from "zod";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Monta uma data UTC; `undefined` se o dia/mês não existe (ex.: 31/02). */
function utcDate(year: number, month: number, day: number, h = 0, min = 0, sec = 0): Date | undefined {
  const date = new Date(Date.UTC(year, month - 1, day, h, min, sec));
  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    h < 24 &&
    min < 60 &&
    sec < 60;
  return valid ? date : undefined;
}

/**
 * Parâmetro de entrada de data nas tools: sempre ISO (`AAAA-MM-DD`).
 * Espalhe no `inputSchema` com `.optional()` e converta com `isoToApiDate`.
 */
export const isoDateInput = z
  .string()
  .refine(
    (value) => {
      const m = ISO_DATE.exec(value);
      return m !== null && utcDate(Number(m[1]), Number(m[2]), Number(m[3])) !== undefined;
    },
    { message: "Data inválida. Use o formato AAAA-MM-DD." },
  );

/** `AAAA-MM-DD` -> `dd/mm/aaaa`, o formato dos parâmetros de data da API. */
export function isoToApiDate(iso: string): string {
  const m = ISO_DATE.exec(iso);
  if (!m || !utcDate(Number(m[1]), Number(m[2]), Number(m[3]))) {
    throw new Error(`Data inválida: "${iso}". Use o formato AAAA-MM-DD.`);
  }
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const API_DATE = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/;

/**
 * Interpreta datas que a API devolve: `dd/mm/aaaa` (Colaboradores, Ocorrências) e
 * `dd/mm/aaaa HH:MM:SS` (Absenteísmo). Devolve um `Date` em UTC (sem fuso: a API não informa),
 * ou `undefined` se o texto for vazio ou não for uma data válida.
 */
export function parseApiDate(value: string | null | undefined): Date | undefined {
  const m = API_DATE.exec((value ?? "").trim());
  if (!m) return undefined;
  const [, day, month, year, h, min, sec] = m;
  return utcDate(Number(year), Number(month), Number(day), Number(h ?? 0), Number(min ?? 0), Number(sec ?? 0));
}
