import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const release = new URL("release/", root);
const output = new URL(`kotoba-pocket-extension-v${pkg.version}.zip`, release);
await mkdir(release, { recursive: true });
await rm(output, { force: true });
async function files(directory, prefix = "") {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = `${prefix}${item.name}`;
    if (item.isDirectory())
      result.push(
        ...(await files(new URL(`${item.name}/`, directory), `${path}/`)),
      );
    else if (item.isFile()) result.push(path);
    else throw new Error(`Unsupported file in package: ${path}`);
  }
  return result.sort();
}
const result = spawnSync(
  "zip",
  ["-q", "-X", output.pathname, ...(await files(new URL("extension/", root)))],
  { cwd: new URL("extension/", root), encoding: "utf8" },
);
if (result.status !== 0)
  throw new Error(result.stderr || "ZIP creation failed");
console.log(`Store-upload ZIP: ${output.pathname}`);
