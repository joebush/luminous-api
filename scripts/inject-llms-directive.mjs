#!/usr/bin/env node
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(fileURLToPath(import.meta.url), "..", "..");
const SENTINEL = "{/* llms-directive */}";
const BLOCK = `${SENTINEL}
<div className="llms-directive">
> For the complete documentation index for AI agents, see [llms.txt](/llms.txt).
</div>
`;

const SKIP_DIRS = new Set(["node_modules", ".git", "snippets"]);

async function* walkMdx(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkMdx(path);
    } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
      yield path;
    }
  }
}

function inject(source) {
  if (source.includes(SENTINEL)) return null;

  const fmMatch = source.match(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/);
  if (fmMatch) {
    const fm = fmMatch[0];
    const rest = source.slice(fm.length);
    const sep = fm.endsWith("\n") ? "" : "\n";
    return `${fm}${sep}\n${BLOCK}\n${rest}`;
  }
  return `${BLOCK}\n${source}`;
}

let injected = 0;
let skipped = 0;

for await (const file of walkMdx(repoRoot)) {
  const source = await readFile(file, "utf8");
  const next = inject(source);
  if (next === null) {
    skipped++;
    continue;
  }
  await writeFile(file, next);
  injected++;
  console.log(`injected: ${relative(repoRoot, file)}`);
}

console.log(`\nllms directive — injected: ${injected}, skipped: ${skipped}`);
