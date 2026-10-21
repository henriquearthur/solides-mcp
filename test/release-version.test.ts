import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkReleaseVersion } from "../scripts/check-release-version.js";

describe("versão da tag de release", () => {
  it("aceita a tag vX.Y.Z quando bate com a versão do package.json", () => {
    expect(checkReleaseVersion("v1.2.3", "1.2.3")).toEqual({ ok: true });
    expect(checkReleaseVersion("refs/tags/v0.1.0", "0.1.0")).toEqual({ ok: true });
  });

  it("aceita pré-lançamento quando a tag e o package.json concordam", () => {
    expect(checkReleaseVersion("v1.0.0-rc.1", "1.0.0-rc.1")).toEqual({ ok: true });
  });

  it("recusa quando a versão do package.json difere da tag, dizendo as duas", () => {
    const result = checkReleaseVersion("v1.2.4", "1.2.3");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("v1.2.4");
      expect(result.message).toContain("1.2.3");
    }
  });

  it("recusa tag sem o prefixo v ou que não é semver", () => {
    expect(checkReleaseVersion("1.2.3", "1.2.3").ok).toBe(false);
    expect(checkReleaseVersion("vfoo", "foo").ok).toBe(false);
    expect(checkReleaseVersion("", "1.2.3").ok).toBe(false);
  });
});

describe("script check-release-version", () => {
  const script = fileURLToPath(new URL("../scripts/check-release-version.ts", import.meta.url));
  const run = (tag: string) =>
    spawnSync(process.execPath, ["--import", "tsx", script, tag], { encoding: "utf8", timeout: 15_000 });

  it("sai com erro e explica quando a tag não bate com o package.json", () => {
    const result = run("v999.0.0");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("v999.0.0");
  });

  it("sai com sucesso quando a tag bate com o package.json", async () => {
    const { version } = (await import("../package.json", { with: { type: "json" } })).default;

    expect(run(`v${version}`).status).toBe(0);
  });
});
