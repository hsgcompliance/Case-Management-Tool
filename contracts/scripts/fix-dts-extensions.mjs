import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = fileURLToPath(new URL("../dist/", import.meta.url));

function hasKnownExtension(specifier) {
  return Boolean(extname(specifier));
}

function addJsExtension(specifier) {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    return specifier;
  }
  if (hasKnownExtension(specifier)) {
    return specifier;
  }
  return `${specifier}.js`;
}

const files = (await readdir(distDir)).filter((file) => file.endsWith(".d.ts"));

for (const file of files) {
  const path = join(distDir, file);
  const original = await readFile(path, "utf8");
  const updated = original
    .replace(/\bfrom\s+(['"])(\.{1,2}\/[^'"]+)\1/g, (_match, quote, specifier) => {
      return `from ${quote}${addJsExtension(specifier)}${quote}`;
    })
    .replace(/\bimport\(\s*(['"])(\.{1,2}\/[^'"]+)\1\s*\)/g, (_match, quote, specifier) => {
      return `import(${quote}${addJsExtension(specifier)}${quote})`;
    });

  if (updated !== original) {
    await writeFile(path, updated);
  }
}
