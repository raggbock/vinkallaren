import { execSync } from "child_process";
import { writeFileSync } from "fs";

const hash = execSync("git rev-parse --short HEAD").toString().trim();
const date = new Date().toISOString().slice(0, 10);
const version = `${date}-${hash}`;

writeFileSync(
  new URL("../src/lib/build-version.ts", import.meta.url),
  `// Auto-generated — do not edit\nexport const BUILD_VERSION = "${version}";\n`
);

console.log(`Build version: ${version}`);
