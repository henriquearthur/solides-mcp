import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readStdioConfig } from "../src/stdio/config.js";

describe("configuração do stdio", () => {
  it("lê o Token de API de SOLIDES_API_TOKEN, com escrita desligada por padrão", () => {
    const config = readStdioConfig({ SOLIDES_API_TOKEN: "abc" });

    expect(config.token).toBe("abc");
    expect(config.allowWrites).toBe(false);
  });

  it("SOLIDES_ALLOW_WRITES=true libera a escrita", () => {
    expect(readStdioConfig({ SOLIDES_API_TOKEN: "abc", SOLIDES_ALLOW_WRITES: "true" }).allowWrites).toBe(true);
    expect(readStdioConfig({ SOLIDES_API_TOKEN: "abc", SOLIDES_ALLOW_WRITES: "false" }).allowWrites).toBe(false);
    expect(readStdioConfig({ SOLIDES_API_TOKEN: "abc", SOLIDES_ALLOW_WRITES: "1" }).allowWrites).toBe(false);
  });

  it("falha com mensagem clara quando SOLIDES_API_TOKEN está ausente ou vazio", () => {
    expect(() => readStdioConfig({})).toThrow(/SOLIDES_API_TOKEN/);
    expect(() => readStdioConfig({ SOLIDES_API_TOKEN: "  " })).toThrow(/SOLIDES_API_TOKEN/);
  });

  it("a mensagem do 401 orienta a verificar SOLIDES_API_TOKEN", () => {
    const config = readStdioConfig({ SOLIDES_API_TOKEN: "abc" });

    expect(config.unauthorizedMessage).toMatch(/token inválido/i);
    expect(config.unauthorizedMessage).toContain("SOLIDES_API_TOKEN");
  });
});

describe("processo stdio", () => {
  it("sai com erro e mensagem clara na inicialização sem SOLIDES_API_TOKEN", () => {
    const bin = fileURLToPath(new URL("../src/stdio/bin.ts", import.meta.url));
    const { SOLIDES_API_TOKEN: _omitido, ...env } = process.env;

    const result = spawnSync(process.execPath, ["--import", "tsx", bin], {
      env,
      encoding: "utf8",
      timeout: 15_000,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("SOLIDES_API_TOKEN");
  });
});
