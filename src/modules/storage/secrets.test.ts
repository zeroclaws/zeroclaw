import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

async function withHome<T>(fn: (home: string) => Promise<T>) {
  const old = process.env.ZEROCLAW_HOME;
  const home = await mkdtemp(join(tmpdir(), 'zeroclaw-secrets-'));
  process.env.ZEROCLAW_HOME = home;
  try { return await fn(home); } finally { if (old === undefined) delete process.env.ZEROCLAW_HOME; else process.env.ZEROCLAW_HOME = old; }
}

test('secret refs are stored in zeroclaw.secrets.json with 0600 permissions', async () => {
  await withHome(async () => {
    const { saveSecret, resolveSecretRef, loadSecrets, secretStatus } = await import('./secrets.js');
    const { secretsPath } = await import('../../shared/paths.js');
    await saveSecret('secret:openai_api_key', 'sk-test-secret');
    assert.equal(await resolveSecretRef('secret:openai_api_key'), 'sk-test-secret');
    const mode = (await stat(secretsPath())).mode & 0o777;
    assert.equal(mode, 0o600);
    const status = secretStatus(await loadSecrets());
    assert.deepEqual(status.secrets.openai_api_key, { configured: true });
    assert.equal(JSON.stringify(status).includes('sk-test-secret'), false);
  });
});

test('oauth refs save token metadata without exposing raw token in config', async () => {
  await withHome(async () => {
    const { saveOAuthCredential, loadSecrets, resolveOAuthCredential, deleteOAuthCredential } = await import('./secrets.js');
    await saveOAuthCredential('openai', { accessToken: 'access', refreshToken: 'refresh', expiresAt: '2030-01-01T00:00:00.000Z', email: 'n@example.com' });
    const file = await loadSecrets();
    assert.equal(file.oauth.openai.accessToken, 'access');
    const resolved = await resolveOAuthCredential('oauth:openai');
    assert.equal(resolved?.refreshToken, 'refresh');
    await deleteOAuthCredential('oauth:openai');
    assert.equal(await resolveOAuthCredential('oauth:openai'), undefined);
  });
});

test('stored credential deletion accepts oauth and secret refs without exposing values in status', async () => {
  await withHome(async () => {
    const { saveSecret, saveOAuthCredential, loadSecrets, deleteStoredCredential, resolveSecretRef, resolveOAuthCredential, secretStatus } = await import('./secrets.js');
    await saveSecret('secret:openai_api_key', 'secret-value');
    await saveOAuthCredential('openai', { accessToken: 'oauth-secret', expiresAt: '2000-01-01T00:00:00.000Z' });
    const status = secretStatus(await loadSecrets());
    assert.equal(status.oauth.openai.status, 'invalid');
    assert.equal(JSON.stringify(status).includes('oauth-secret'), false);
    await deleteStoredCredential('secret:openai_api_key');
    await deleteStoredCredential('oauth:openai');
    assert.equal(await resolveSecretRef('secret:openai_api_key'), undefined);
    assert.equal(await resolveOAuthCredential('oauth:openai'), undefined);
  });
});
