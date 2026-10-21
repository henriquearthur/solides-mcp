import { describe, expect, it } from "vitest";
import { isoToApiDate, parseApiDate } from "../src/core/dates.js";
import { includesText, normalizeText } from "../src/core/text.js";

describe("isoToApiDate", () => {
  it("converte AAAA-MM-DD para dd/mm/aaaa", () => {
    expect(isoToApiDate("2024-03-09")).toBe("09/03/2024");
  });

  it("rejeita data fora do ISO ou inexistente", () => {
    expect(() => isoToApiDate("09/03/2024")).toThrow();
    expect(() => isoToApiDate("2023-02-29")).toThrow();
  });
});

describe("parseApiDate", () => {
  it("aceita dd/mm/aaaa", () => {
    expect(parseApiDate("31/12/2023")?.toISOString()).toBe("2023-12-31T00:00:00.000Z");
  });

  it("aceita dd/mm/aaaa HH:MM:SS (Absenteísmo)", () => {
    expect(parseApiDate("05/01/2024 13:45:09")?.toISOString()).toBe("2024-01-05T13:45:09.000Z");
  });

  it("devolve undefined para vazio, formato desconhecido ou data inexistente", () => {
    expect(parseApiDate("")).toBeUndefined();
    expect(parseApiDate(undefined)).toBeUndefined();
    expect(parseApiDate("2024-01-05")).toBeUndefined();
    expect(parseApiDate("31/02/2024")).toBeUndefined();
    expect(parseApiDate("05/01/2024 25:00:00")).toBeUndefined();
  });

  it("permite comparar datas da API por ordem cronológica", () => {
    const a = parseApiDate("01/02/2024 08:00:00");
    const b = parseApiDate("01/02/2024");
    const c = parseApiDate("02/01/2025");
    expect(a!.getTime()).toBeGreaterThan(b!.getTime());
    expect(c!.getTime()).toBeGreaterThan(a!.getTime());
  });
});

describe("texto sem acento nem maiúsculas", () => {
  it("normalizeText tira acentos, caixa e espaços nas pontas", () => {
    expect(normalizeText("  João AÇÃO ")).toBe("joao acao");
  });

  it("includesText procura trecho e trata ausência como vazio", () => {
    expect(includesText("Recursos Humanos", "HUMAN")).toBe(true);
    expect(includesText(undefined, "x")).toBe(false);
  });
});
