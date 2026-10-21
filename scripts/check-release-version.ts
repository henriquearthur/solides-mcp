// Confere se a tag de release (vX.Y.Z) bate com a versão do package.json.
// Uso: tsx scripts/check-release-version.ts "$GITHUB_REF_NAME"
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export type ReleaseVersionCheck = { ok: true } | { ok: false; message: string };

const TAG = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/;

export function checkReleaseVersion(ref: string, packageVersion: string): ReleaseVersionCheck {
  const tag = ref.replace(/^refs\/tags\//, "");
  const match = TAG.exec(tag);
  if (!match) {
    return { ok: false, message: `A tag "${tag}" não segue o formato vX.Y.Z (ex.: v1.2.3).` };
  }
  if (match[1] !== packageVersion) {
    return {
      ok: false,
      message: `A tag ${tag} não bate com a versão ${packageVersion} do package.json. Ajuste a versão ou a tag.`,
    };
  }
  return { ok: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const packageJson = fileURLToPath(new URL("../package.json", import.meta.url));
  const { version } = JSON.parse(readFileSync(packageJson, "utf8")) as { version: string };
  const result = checkReleaseVersion(process.argv[2] ?? "", version);
  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
  }
  console.log(`Tag ${process.argv[2]} confere com a versão ${version} do package.json.`);
}
