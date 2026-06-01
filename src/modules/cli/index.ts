#!/usr/bin/env node
import { Command } from 'commander';
import { ZEROCLAW_SPEC_VERSION } from '../../shared/constants.js';
import { ensureWorkspace } from '../storage/workspace.js';
import { runDoctor } from '../system/doctor.js';
import { startSetupDashboard } from '../dashboard/server.js';
import { loadConfig } from '../storage/config.js';

const program = new Command();

program
  .name('zeroclaw')
  .description('Lightweight AI agent runtime for Linux/VPS machines')
  .version(`0.1.0 (spec ${ZEROCLAW_SPEC_VERSION})`);

program.command('init').description('Create ~/.zeroclaw workspace and default config').action(async () => {
  await ensureWorkspace();
  console.log('✓ Zeroclaw workspace initialized at ~/.zeroclaw');
  console.log('Next: zeroclaw doctor && zeroclaw setup');
});

program.command('doctor').description('Check local Zeroclaw setup').action(async () => {
  process.exitCode = await runDoctor();
});

program.command('setup').description('Start temporary setup dashboard').action(async () => {
  await ensureWorkspace();
  const config = await loadConfig();
  await startSetupDashboard(config.dashboard.setupPort);
});

program.command('start').description('Start Zeroclaw runtime placeholder').action(async () => {
  await ensureWorkspace();
  const config = await loadConfig();
  console.log(`Zeroclaw runtime placeholder: provider=${config.provider.preset}, model=${config.provider.model}`);
});

program.command('status').description('Show Zeroclaw status').action(async () => {
  await ensureWorkspace();
  const config = await loadConfig();
  console.log(`Spec: ${ZEROCLAW_SPEC_VERSION}`);
  console.log(`Provider: ${config.provider.preset}`);
  console.log(`Model: ${config.provider.model}`);
  console.log(`Telegram: ${config.telegram.enabled ? 'enabled' : 'disabled'} (${config.telegram.groupMode})`);
});

program.command('logs').description('Show log placeholder').action(() => {
  console.log('Logs are not implemented yet. Runtime log path will be ~/.zeroclaw/logs/zeroclaw.log');
});

program.command('update').description('Show update instructions').action(() => {
  console.log('Update after npm release: npm update -g zeroclaw');
});

const config = program.command('config').description('Read/write config');
config.command('get').argument('[key]').action(async (key?: string) => {
  const cfg = await loadConfig();
  console.log(JSON.stringify(key ? (cfg as any)[key] : cfg, null, 2));
});
config.command('set').argument('<key>').argument('<value>').action(() => {
  console.log('config set is not implemented yet; edit ~/.zeroclaw/zeroclaw.json for now.');
});

const service = program.command('service').description('Manage systemd service placeholder');
for (const name of ['install', 'start', 'stop', 'restart', 'status']) {
  service.command(name).action(() => console.log(`service ${name} is not implemented yet.`));
}

await program.parseAsync(process.argv);
