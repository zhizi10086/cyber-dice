import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const desktopDirectory = path.resolve(scriptDirectory, "..");
const projectDirectory = path.resolve(desktopDirectory, "..");
const destination = path.join(desktopDirectory, "dist");

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

for (const file of [
  "index.html",
  "styles.css",
  "app.js",
  "manifest.json",
  "sw.js",
  "THIRD_PARTY_NOTICES.md",
]) {
  await cp(path.join(projectDirectory, file), path.join(destination, file));
}

for (const directory of ["assets", "vendor"]) {
  await cp(
    path.join(projectDirectory, directory),
    path.join(destination, directory),
    { recursive: true },
  );
}
