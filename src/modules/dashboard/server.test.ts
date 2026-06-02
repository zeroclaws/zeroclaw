import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createDashboardServer } from './server.js';
import { defaultConfig } from '../storage/config.js';

async function login(app: Awaited<ReturnType<typeof createDashboardServer>>) {
  const response = await app.inject({ method: 'POST', url: '/api/login', headers: { 'content-type': 'application/json' }, payload: { password: '123456' } });
  return (response.json() as { token: string }).token;
}

test('login is public and status requires bearer token', async () => {
  const app = await createDashboardServer({ password: '123456' });
  try {
    const loginPage = await app.inject({ method: 'GET', url: '/login' });
    assert.equal(loginPage.statusCode, 200);

    const blocked = await app.inject({ method: 'GET', url: '/api/status' });
    assert.equal(blocked.statusCode, 401);

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/login',
      headers: { 'content-type': 'application/json' },
      payload: { password: '123456' }
    });
    assert.equal(loginResponse.statusCode, 200);
    const body = loginResponse.json() as { token: string };
    assert.equal(typeof body.token, 'string');
    assert.ok(body.token.length > 20);

    const ok = await app.inject({ method: 'GET', url: '/api/status', headers: { authorization: `Bearer ${body.token}` } });
    assert.equal(ok.statusCode, 200);
  } finally {
    await app.close();
  }
});

test('settings shell route is an authenticated app page', async () => {
  const app = await createDashboardServer({ password: '123456' });
  try {
    const loginPage = await app.inject({ method: 'GET', url: '/settings' });
    assert.equal(loginPage.statusCode, 200);
    assert.match(loginPage.body, /login/i);

    const token = await login(app);
    const page = await app.inject({ method: 'GET', url: '/settings', headers: { authorization: `Bearer ${token}` } });
    assert.equal(page.statusCode, 200);
    assert.match(page.headers['content-type'] as string, /text\/html/);
  } finally {
    await app.close();
  }
});

test('provider validation rejects unsafe baseUrl and unknown keys', async () => {
  const app = await createDashboardServer({ password: '123456' });
  try {
    const token = await login(app);
    const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

    const unsafe = await app.inject({ method: 'POST', url: '/api/config/provider', headers: auth, payload: { baseUrl: 'http://example.com', credentialRef: 'env:KEY' } });
    assert.equal(unsafe.statusCode, 400);

    const unknown = await app.inject({ method: 'POST', url: '/api/config/provider', headers: auth, payload: { model: 'x', extra: true } });
    assert.equal(unknown.statusCode, 400);
  } finally {
    await app.close();
  }
});

test('provider credential health is protected and invalid oauth metadata does not leak tokens', async () => {
  const oldHome = process.env.ZEROCLAW_HOME;
  process.env.ZEROCLAW_HOME = await mkdtemp(join(tmpdir(), 'zeroclaw-health-'));
  const { saveOAuthCredential } = await import('../storage/secrets.js');
  await saveOAuthCredential('openai', { accessToken: 'sk-secret-token', expiresAt: '2000-01-01T00:00:00.000Z', refreshToken: 'refresh-secret' });
  const app = await createDashboardServer({ password: '123456', config: defaultConfig() });
  try {
    const blocked = await app.inject({ method: 'GET', url: '/api/provider/credential-health' });
    assert.equal(blocked.statusCode, 401);
    const token = await login(app);
    const health = await app.inject({ method: 'GET', url: '/api/provider/credential-health', headers: { authorization: `Bearer ${token}` } });
    assert.equal(health.statusCode, 200);
    assert.equal((health.json() as { status: string }).status, 'invalid');
    assert.equal(health.body.includes('sk-secret-token'), false);
    assert.equal(health.body.includes('refresh-secret'), false);
  } finally {
    await app.close();
    if (oldHome === undefined) delete process.env.ZEROCLAW_HOME; else process.env.ZEROCLAW_HOME = oldHome;
  }
});

test('provider credential clear removes stored oauth then health reports missing', async () => {
  const oldHome = process.env.ZEROCLAW_HOME;
  process.env.ZEROCLAW_HOME = await mkdtemp(join(tmpdir(), 'zeroclaw-clear-'));
  const { saveOAuthCredential } = await import('../storage/secrets.js');
  await saveOAuthCredential('openai', { accessToken: 'clear-secret-token', expiresAt: '2030-01-01T00:00:00.000Z' });
  const app = await createDashboardServer({ password: '123456', config: defaultConfig() });
  try {
    const token = await login(app);
    const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const cleared = await app.inject({ method: 'POST', url: '/api/provider/credential-clear', headers: auth, payload: {} });
    assert.equal(cleared.statusCode, 200);
    assert.equal(cleared.body.includes('clear-secret-token'), false);
    const health = await app.inject({ method: 'GET', url: '/api/provider/credential-health', headers: { authorization: `Bearer ${token}` } });
    assert.equal((health.json() as { status: string }).status, 'missing');
  } finally {
    await app.close();
    if (oldHome === undefined) delete process.env.ZEROCLAW_HOME; else process.env.ZEROCLAW_HOME = oldHome;
  }
});

test('chat credential-error is friendly and does not leak provider token', async () => {
  const oldHome = process.env.ZEROCLAW_HOME;
  const oldFetch = globalThis.fetch;
  process.env.ZEROCLAW_HOME = await mkdtemp(join(tmpdir(), 'zeroclaw-chat-'));
  const { saveOAuthCredential } = await import('../storage/secrets.js');
  await saveOAuthCredential('openai', { accessToken: 'chat-secret-token', expiresAt: '2030-01-01T00:00:00.000Z' });
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: 'invalid token chat-secret-token' } }), { status: 401, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  const app = await createDashboardServer({ password: '123456', config: defaultConfig() });
  try {
    const token = await login(app);
    const result = await app.inject({ method: 'POST', url: '/api/chat', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { messages: [{ role: 'user', content: 'hi' }] } });
    assert.equal(result.statusCode, 200);
    const body = result.json() as { ok: boolean; mode: string };
    assert.equal(body.ok, false);
    assert.equal(body.mode, 'credential-error');
    assert.equal(result.body.includes('chat-secret-token'), false);
  } finally {
    await app.close();
    globalThis.fetch = oldFetch;
    if (oldHome === undefined) delete process.env.ZEROCLAW_HOME; else process.env.ZEROCLAW_HOME = oldHome;
  }
});


test('settings API is protected and never leaks password hash metadata', async () => {
  const config = defaultConfig();
  const app = await createDashboardServer({ password: '123456', config });
  try {
    const blocked = await app.inject({ method: 'GET', url: '/api/settings' });
    assert.equal(blocked.statusCode, 401);

    const token = await login(app);
    const response = await app.inject({ method: 'GET', url: '/api/settings', headers: { authorization: `Bearer ${token}` } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.includes('stored-secret-hash'), false);
    assert.equal(response.body.includes('stored-secret-salt'), false);
    const body = response.json() as { dashboard: { hasPasswordHash: boolean }, chat: { enabled: boolean, systemPrompt: string, historyLimit: number } };
    assert.equal(body.dashboard.hasPasswordHash, false);
    assert.equal(body.chat.enabled, true);
  } finally {
    await app.close();
  }
});

test('password change requires old password, stores scrypt metadata, and old login stops working', async () => {
  const config = defaultConfig();
  const app = await createDashboardServer({ password: '123456', config });
  try {
    const token = await login(app);
    const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const wrong = await app.inject({ method: 'POST', url: '/api/settings/password', headers: auth, payload: { oldPassword: 'bad', newPassword: 'new-strong-password' } });
    assert.equal(wrong.statusCode, 401);

    const changed = await app.inject({ method: 'POST', url: '/api/settings/password', headers: auth, payload: { oldPassword: '123456', newPassword: 'new-strong-password' } });
    assert.equal(changed.statusCode, 200);
    assert.equal(changed.body.includes('passwordHash'), false);

    const oldLogin = await app.inject({ method: 'POST', url: '/api/login', headers: { 'content-type': 'application/json' }, payload: { password: '123456' } });
    assert.equal(oldLogin.statusCode, 401);
    const newLogin = await app.inject({ method: 'POST', url: '/api/login', headers: { 'content-type': 'application/json' }, payload: { password: 'new-strong-password' } });
    assert.equal(newLogin.statusCode, 200);
    const newToken = (newLogin.json() as { token: string }).token;
    const settings = await app.inject({ method: 'GET', url: '/api/settings', headers: { authorization: `Bearer ${newToken}` } });
    assert.equal((settings.json() as { dashboard: { hasPasswordHash: boolean } }).dashboard.hasPasswordHash, true);
  } finally {
    await app.close();
  }
});

test('provider models import from OAuth credential and never leak token', async () => {
  const oldHome = process.env.ZEROCLAW_HOME;
  const oldFetch = globalThis.fetch;
  process.env.ZEROCLAW_HOME = await mkdtemp(join(tmpdir(), 'zeroclaw-models-oauth-'));
  const { saveOAuthCredential } = await import('../storage/secrets.js');
  await saveOAuthCredential('openai', { accessToken: 'models-secret-token', expiresAt: '2030-01-01T00:00:00.000Z', email: 'n@example.com' });
  globalThis.fetch = (async (url, init) => {
    assert.match(String(url), /\/models$/);
    assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer models-secret-token');
    return new Response(JSON.stringify({ data: [{ id: 'gpt-z-test' }, { id: 'gpt-a-test' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const app = await createDashboardServer({ password: '123456', config: defaultConfig() });
  try {
    const token = await login(app);
    const models = await app.inject({ method: 'GET', url: '/api/provider/models', headers: { authorization: `Bearer ${token}` } });
    assert.equal(models.statusCode, 200);
    const body = models.json() as { ok: boolean; models: string[]; source: string; account?: { email?: string } };
    assert.equal(body.ok, true);
    assert.equal(body.source, 'provider');
    assert.deepEqual(body.models.includes('gpt-z-test'), true);
    assert.deepEqual(body.models.includes('gpt-a-test'), true);
    assert.equal(body.account?.email, 'n@example.com');
    assert.equal(models.body.includes('models-secret-token'), false);
  } finally {
    await app.close();
    globalThis.fetch = oldFetch;
    if (oldHome === undefined) delete process.env.ZEROCLAW_HOME; else process.env.ZEROCLAW_HOME = oldHome;
  }
});

test('provider models reports credential-error for expired oauth without token leak', async () => {
  const oldHome = process.env.ZEROCLAW_HOME;
  const oldFetch = globalThis.fetch;
  process.env.ZEROCLAW_HOME = await mkdtemp(join(tmpdir(), 'zeroclaw-models-expired-'));
  const { saveOAuthCredential } = await import('../storage/secrets.js');
  await saveOAuthCredential('openai', { accessToken: 'expired-model-token', expiresAt: '2000-01-01T00:00:00.000Z' });
  globalThis.fetch = (async () => { throw new Error('fetch should not be called for expired oauth'); }) as typeof fetch;
  const app = await createDashboardServer({ password: '123456', config: defaultConfig() });
  try {
    const token = await login(app);
    const models = await app.inject({ method: 'GET', url: '/api/provider/models', headers: { authorization: `Bearer ${token}` } });
    assert.equal(models.statusCode, 200);
    const body = models.json() as { ok: boolean; mode: string; credential: { status: string }; models: string[] };
    assert.equal(body.ok, false);
    assert.equal(body.mode, 'credential-error');
    assert.equal(body.credential.status, 'invalid');
    assert.equal(body.models.includes('gpt-4o-mini'), true);
    assert.equal(models.body.includes('expired-model-token'), false);
  } finally {
    await app.close();
    globalThis.fetch = oldFetch;
    if (oldHome === undefined) delete process.env.ZEROCLAW_HOME; else process.env.ZEROCLAW_HOME = oldHome;
  }
});

test('provider models reports credential-error for provider 401 without token leak', async () => {
  const oldHome = process.env.ZEROCLAW_HOME;
  const oldFetch = globalThis.fetch;
  process.env.ZEROCLAW_HOME = await mkdtemp(join(tmpdir(), 'zeroclaw-models-invalid-'));
  const { saveOAuthCredential } = await import('../storage/secrets.js');
  await saveOAuthCredential('openai', { accessToken: 'invalid-model-token', expiresAt: '2030-01-01T00:00:00.000Z' });
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: 'invalid token invalid-model-token' } }), { status: 401, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  const app = await createDashboardServer({ password: '123456', config: defaultConfig() });
  try {
    const token = await login(app);
    const models = await app.inject({ method: 'GET', url: '/api/provider/models', headers: { authorization: `Bearer ${token}` } });
    assert.equal(models.statusCode, 200);
    const body = models.json() as { ok: boolean; mode: string; credential: { status: string }; models: string[] };
    assert.equal(body.ok, false);
    assert.equal(body.mode, 'credential-error');
    assert.equal(body.credential.status, 'invalid');
    assert.equal(body.models.includes('gpt-4o-mini'), true);
    assert.equal(models.body.includes('invalid-model-token'), false);
  } finally {
    await app.close();
    globalThis.fetch = oldFetch;
    if (oldHome === undefined) delete process.env.ZEROCLAW_HOME; else process.env.ZEROCLAW_HOME = oldHome;
  }
});

test('chat settings save system prompt and chat endpoint forwards it', async () => {
  const oldFetch = globalThis.fetch;
  process.env.ZEROCLAW_TEST_KEY = 'chat-test-token';
  const config = defaultConfig();
  config.provider.credentialRef = 'env:ZEROCLAW_TEST_KEY';
  let requestBody = '';
  globalThis.fetch = (async (_url, init) => {
    requestBody = String(init?.body ?? '');
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const app = await createDashboardServer({ password: '123456', config });
  try {
    const token = await login(app);
    const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const saved = await app.inject({ method: 'POST', url: '/api/settings/chat', headers: auth, payload: { enabled: true, systemPrompt: 'Be concise.', historyLimit: 3 } });
    assert.equal(saved.statusCode, 200);

    const chat = await app.inject({ method: 'POST', url: '/api/chat', headers: auth, payload: { messages: [{ role: 'user', content: 'hi' }] } });
    assert.equal(chat.statusCode, 200);
    const providerPayload = JSON.parse(requestBody) as { messages: Array<{ role: string, content: string }> };
    assert.deepEqual(providerPayload.messages[0], { role: 'system', content: 'Be concise.' });
  } finally {
    await app.close();
    globalThis.fetch = oldFetch;
    delete process.env.ZEROCLAW_TEST_KEY;
  }
});
