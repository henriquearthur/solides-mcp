import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

type PackResult = { filename: string; files: { path: string }[] };

let packDir: string;
let files: string[];
let manifest: { bin: Record<string, string>; dependencies: Record<string, string> };

beforeAll(() => {
  execFileSync(npm, ["run", "build"], { cwd: root, stdio: "ignore" });
  packDir = mkdtempSync(join(tmpdir(), "solides-mcp-pack-"));
  const out = execFileSync(npm, ["pack", "--json", "--ignore-scripts", "--pack-destination", packDir], {
    cwd: root,
    encoding: "utf8",
  });
  const [pack] = JSON.parse(out) as PackResult[];
  files = pack!.files.map((f) => f.path);
  manifest = JSON.parse(
    execFileSync("tar", ["-xzOf", join(packDir, pack!.filename), "package/package.json"], { encoding: "utf8" }),
  );
}, 120_000);

afterAll(() => {
  if (packDir) rmSync(packDir, { recursive: true, force: true });
});

describe("pacote npm", () => {
  it("inclui o binário stdio apontado por bin.solides-mcp", () => {
    expect(manifest.bin["solides-mcp"]).toBe("dist/stdio/bin.js");
    expect(files).toContain("dist/stdio/bin.js");
  });

  it("não inclui o código-fonte nem o código do Worker", () => {
    expect(files.filter((f) => f.startsWith("src/") || f.includes("worker"))).toEqual([]);
    expect(files.filter((f) => f.startsWith("test/") || f.startsWith("scripts/"))).toEqual([]);
  });

  it("depende só do SDK do MCP e do zod, sem dependências do Worker", () => {
    expect(Object.keys(manifest.dependencies).sort()).toEqual(["@modelcontextprotocol/sdk", "zod"]);
  });
});
