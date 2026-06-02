#!/usr/bin/env node
import { Command } from 'commander';
import { ZEROCLAW_SPEC_VERSION } from '../../shared/constants.js';
import { ensureWorkspace } from '../storage/workspace.js';
import { runDoctor } from '../system/doctor.js';
import { startSetupDashboard } from '../dashboard/server.js';
import { loadConfig } from '../storage/config.js';
import { loadAgentContext, loadAgentSystemPrompt, parseIdentity } from '../agent/context.js';
import { runtimeLogs, runtimeStatus, startRuntime, stopRuntime, restartRuntime } from '../runtime/daemon.js';

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

program.command('start').description('Start Zeroclaw runtime daemon').action(async () => {
  await ensureWorkspace();
  const config = await loadConfig();
  console.log(JSON.stringify({ ...(await startRuntime()), provider: config.provider.preset, model: config.provider.model }, null, 2));
});

program.command('status').description('Show Zeroclaw status').action(async () => {
  await ensureWorkspace();
  const config = await loadConfig();
  console.log(JSON.stringify({ specVersion: ZEROCLAW_SPEC_VERSION, provider: config.provider.preset, model: config.provider.model, telegram: { enabled: config.telegram.enabled, groupMode: config.telegram.groupMode }, runtime: await runtimeStatus() }, null, 2));
});

program.command('logs').description('Show runtime logs').option('--lines <n>', 'number of lines', '200').action(async (opts: { lines: string }) => {
  await ensureWorkspace();
  const logs = await runtimeLogs(Number(opts.lines) || 200);
  for (const line of logs.lines) console.log(line);
});

program.command('update').description('Show update instructions').action(() => {
  console.log('Update after npm release: npm update -g zeroclaw');
});


const agent = program.command('agent').description('Inspect local agent identity and context');
agent.command('identity').description('Show loaded agent identity').action(async () => {
  await ensureWorkspace();
  const cfg = await loadConfig();
  const files = await loadAgentContext(cfg.agent.defaultAgent);
  console.log(JSON.stringify(parseIdentity(files), null, 2));
});
agent.command('context').description('List loaded core context files').action(async () => {
  await ensureWorkspace();
  const cfg = await loadConfig();
  const files = await loadAgentContext(cfg.agent.defaultAgent);
  for (const file of files) console.log(`${file.name}	${file.content.length} chars	${file.path}`);
});
agent.command('prompt').description('Print assembled system prompt preview').option('--chars <n>', 'max characters', '4000').action(async (opts: { chars: string }) => {
  await ensureWorkspace();
  const cfg = await loadConfig();
  const prompt = await loadAgentSystemPrompt(cfg.agent.defaultAgent, cfg.chat.systemPrompt);
  console.log(prompt.slice(0, Number(opts.chars) || 4000));
});

const config = program.command('config').description('Read/write config');
config.command('get').argument('[key]').action(async (key?: string) => {
  const cfg = await loadConfig();
  console.log(JSON.stringify(key ? (cfg as any)[key] : cfg, null, 2));
});
config.command('set').argument('<key>').argument('<value>').action(() => {
  console.log('config set is not implemented yet; edit ~/.zeroclaw/zeroclaw.json for now.');
});

const service = program.command('service').description('Manage runtime service placeholder');
service.command('start').action(async () => { await ensureWorkspace(); console.log(JSON.stringify(await startRuntime(), null, 2)); });
service.command('stop').action(async () => { await ensureWorkspace(); console.log(JSON.stringify(await stopRuntime(), null, 2)); });
service.command('restart').action(async () => { await ensureWorkspace(); console.log(JSON.stringify(await restartRuntime(), null, 2)); });
service.command('status').action(async () => { await ensureWorkspace(); console.log(JSON.stringify(await runtimeStatus(), null, 2)); });
service.command('install').action(() => console.log('service install is not implemented yet.'));

await program.parseAsync(process.argv);
