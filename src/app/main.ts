import { ensureWorkspace } from '../modules/storage/workspace.js';
import { loadConfig } from '../modules/storage/config.js';

await ensureWorkspace();
const config = await loadConfig();
console.log(`Zeroclaw runtime placeholder started with provider=${config.provider.preset}, model=${config.provider.model}`);
