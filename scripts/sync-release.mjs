import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = (process.argv[2] || "").replace(/^v/, "");
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error("Usage: npm run sync:release -- <release tag or version>");
}

for (const file of ["package.json", "package-lock.json", "data/site-data.json"]) {
  const target = path.join(root, file);
  const data = JSON.parse(fs.readFileSync(target, "utf8"));
  data.version = version;
  if (file === "package-lock.json") data.packages[""].version = version;
  fs.writeFileSync(target, JSON.stringify(data, null, 2) + "\n");
}

// Only current installation examples change; historical benchmark pins stay intact.
const installation = path.join(root, "content/docs/installation.md");
const source = fs.readFileSync(installation, "utf8");
const updated = source
  .replace(/(@aziron(?:-ai)?\/atlas@)\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/g, `$1${version}`)
  .replace(/(^VERSION=)\S+/gm, `$1${version}`)
  .replace(/atlas_\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?_linux_/g, `atlas_${version}_linux_`);
for (const example of [
  `@aziron/atlas@${version}`, `@aziron-ai/atlas@${version}`, `VERSION=${version}`,
  ...["deb", "rpm", "apk"].map(ext => `atlas_${version}_linux_amd64.${ext}`),
]) {
  if (!updated.includes(example)) throw new Error(`Installation example missing: ${example}`);
}
fs.writeFileSync(installation, updated);
console.log(`Release metadata and installation examples synchronized to v${version}`);
