import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const distAssets = join(process.cwd(), "dist", "assets");
const maxBytes = 500 * 1024;

const offenders = readdirSync(distAssets)
  .filter((file) => file.endsWith(".js"))
  .map((file) => ({ file, size: statSync(join(distAssets, file)).size }))
  .filter(({ size }) => size > maxBytes);

if (offenders.length > 0) {
  console.error("Bundle budget exceeded (500KB per JS asset):");
  offenders.forEach(({ file, size }) => {
    console.error(`- ${file}: ${(size / 1024).toFixed(1)}KB`);
  });
  process.exit(1);
}

console.log("Bundle size check passed.");
