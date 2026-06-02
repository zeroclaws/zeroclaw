import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const source = 'src/modules/dashboard/public';
const target = 'dist/modules/dashboard/public';

if (!existsSync(source)) {
  process.exit(0);
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
