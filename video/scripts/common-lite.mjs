import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const repoRoot = path.resolve(root, "..");
export const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
