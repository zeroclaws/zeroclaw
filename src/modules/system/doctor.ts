import { existsSync, statSync } from 'node:fs';
import { configPath, dataDir, envPath } from '../../shared/paths.js';
import { loadConfig } from '../storage/config.js';

export async function runDoctor(): Promise<number> {
  let failures = 0;
  const check = (ok: boolean, label: string, fix?: string) => {
    console.log(`${ok ? '✓' : '✗'} ${label}`);
    if (!ok) {
      failures += 1;
      if (fix) console.log(`  Fix: ${fix}`);
    }
  };

  const major = Number(process.versions.node.split('.')[0]);
  check(major >= 20, `Node.js ${process.versions.node}`, 'Install Node.js 20 or newer.');
  check(existsSync(dataDir()), `${dataDir()} exists`, 'Run: zeroclaw init');
  check(existsSync(configPath()), 'zeroclaw.json exists', 'Run: zeroclaw init');
  check(existsSync(envPath()), 'zeroclaw.env exists', 'Run: zeroclaw init');

  if (existsSync(envPath())) {
    const mode = statSync(envPath()).mode & 0o777;
    check(mode === 0o600 || mode === 0o400, `zeroclaw.env permission ${mode.toString(8)}`, 'Run: chmod 600 ~/.zeroclaw/zeroclaw.env');
  }

  try {
    const config = await loadConfig();
    check(true, `config valid, provider=${config.provider.preset}, model=${config.provider.model}`);
  } catch (error) {
    check(false, `config invalid: ${error instanceof Error ? error.message : String(error)}`, 'Check ~/.zeroclaw/zeroclaw.json');
  }

  return failures === 0 ? 0 : 1;
}
