import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createDashboardServer } from './server.js';
import { defaultConfig } from '../storage/config.js';

test('oauth exchange provider failure returns safe fallback contract without storing tokens', async () => {
  const oldHome = process.env.ZEROCLAW_HOME;
  const oldFetch = globalThis.fetch;
  const oldCallbackPort = process.env.ZEROCLAW_OAUTH_CALLBACK_PORT;
  process.env.ZEROCLAW_OAUTH_CALLBACK_PORT = '0';
  process.env.ZEROCLAW_HOME = await mkdtemp(join(tmpdir(), 'zeroclaw-oauth-exchange-fallback-'));
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const target = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    if (target.startsWith('http://127.0.0.1:') || target.startsWith('http://localhost:')) return oldFetch(url, init);
    return new Response(JSON.stringify({ error: 'provider said bad secret-token' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const app = await createDashboardServer({ password: '123456', config: defaultConfig() });
  try {
    const login = await app.inject({ method: 'POST', url: '/api/login', headers: { 'content-type': 'application/json' }, payload: { password: '123456' } });
    const token = JSON.parse(login.body).token;
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const oauth = await app.inject({ method: 'POST', url: '/api/provider/oauth-url', headers, payload: { provider: 'openai' } });
    const connectUrl = new URL(JSON.parse(oauth.body).connectUrl);
    const exchange = await app.inject({ method: 'POST', url: '/api/provider/oauth/exchange', headers, payload: { provider: 'openai', state: connectUrl.searchParams.get('state'), code: 'bad-code' } });
    assert.equal(exchange.statusCode, 502);
    const body = exchange.json() as { ok: boolean; code: string; fallbackRequired: boolean; fallback: { provider: string; fields: string[] } };
    assert.equal(body.ok, false);
    assert.equal(body.code, 'oauth_exchange_failed');
    assert.equal(body.fallbackRequired, true);
    assert.deepEqual(body.fallback, { provider: 'openai', fields: ['baseUrl', 'apiKey', 'model'] });
    assert.equal(exchange.body.includes('secret-token'), false);
    const { resolveOAuthCredential } = await import('../storage/secrets.js');
    assert.equal(await resolveOAuthCredential('oauth:openai'), undefined);
  } finally {
    await app.close();
    globalThis.fetch = oldFetch;
    if (oldHome === undefined) delete process.env.ZEROCLAW_HOME; else process.env.ZEROCLAW_HOME = oldHome;
    if (oldCallbackPort === undefined) delete process.env.ZEROCLAW_OAUTH_CALLBACK_PORT; else process.env.ZEROCLAW_OAUTH_CALLBACK_PORT = oldCallbackPort;
  }
});

function makeJwt(payload: Record<string, unknown>) {
  const enc = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${enc({ alg: 'none', typ: 'JWT' })}.${enc(payload)}.`;
}

test('oauth callback exchanges code and stores tokens in json secrets', async () => {
  const oldHome = process.env.ZEROCLAW_HOME;
  const oldFetch = globalThis.fetch;
  const oldCallbackPort = process.env.ZEROCLAW_OAUTH_CALLBACK_PORT;
  process.env.ZEROCLAW_OAUTH_CALLBACK_PORT = '0';
  process.env.ZEROCLAW_HOME = await mkdtemp(join(tmpdir(), 'zeroclaw-oauth-'));
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const target = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    if (target.startsWith('http://127.0.0.1:') || target.startsWith('http://localhost:')) return oldFetch(url, init);
    assert.equal(init?.method, 'POST');
    const body = init?.body as URLSearchParams;
    assert.equal(body.get('grant_type'), 'authorization_code');
    assert.equal(body.get('code'), 'auth-code');
    assert.match(body.get('redirect_uri') ?? '', /^http:\/\/localhost:\d+\/auth\/callback$/);
    assert.equal(body.get('client_id'), 'app_EMoamEEZ73f0CkXaXp7hrann');
    const requestHeaders = init?.headers as Record<string, string>;
    assert.equal(requestHeaders.accept || requestHeaders.Accept, 'application/json');
    assert.ok(body.get('code_verifier'));
    return new Response(JSON.stringify({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      scope: 'openid profile email offline_access api.model.read',
      id_token: makeJwt({ email: 'n@example.com', 'https://api.openai.com/auth': { chatgpt_account_id: 'acc-test', chatgpt_plan_type: 'plus' } })
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const app = await createDashboardServer({ password: '123456', config: defaultConfig() });
  try {
    const login = await app.inject({ method: 'POST', url: '/api/login', headers: { 'content-type': 'application/json' }, payload: { password: '123456' } });
    const token = JSON.parse(login.body).token;
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const oauth = await app.inject({ method: 'POST', url: '/api/provider/oauth-url', headers, payload: { provider: 'openai' } });
    const connectUrl = new URL(JSON.parse(oauth.body).connectUrl);
    const state = connectUrl.searchParams.get('state');
    assert.ok(state);
    assert.equal(connectUrl.origin + connectUrl.pathname, 'https://auth.openai.com/oauth/authorize');
    assert.equal(connectUrl.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(connectUrl.searchParams.get('id_token_add_organizations'), 'true');
    assert.equal(connectUrl.searchParams.get('originator'), 'openai_native');
    assert.match(connectUrl.searchParams.get('redirect_uri') ?? '', /^http:\/\/localhost:\d+\/auth\/callback$/);
    assert.match(connectUrl.searchParams.get('code_challenge') ?? '', /^[A-Za-z0-9_-]{43}$/);
    assert.equal(connectUrl.searchParams.get('code_challenge'), JSON.parse(oauth.body).url && new URL(JSON.parse(oauth.body).url).searchParams.get('code_challenge'));
    const redirectUri = connectUrl.searchParams.get('redirect_uri') ?? '';

    const callback = await fetch(`${redirectUri}?state=${state}&code=auth-code`);
    assert.equal(callback.status, 200);
    const callbackHtml = await callback.text();
    assert.match(callbackHtml, /zeroclaw-oauth-connected/);
    assert.match(callbackHtml, /oauth=connected/);
    assert.equal(callbackHtml.includes('access-token'), false);
    assert.equal(callbackHtml.includes('refresh-token'), false);

    const { resolveOAuthCredential } = await import('../storage/secrets.js');
    const stored = await resolveOAuthCredential('oauth:openai');
    assert.equal(stored?.accessToken, 'access-token');
    assert.equal(stored?.refreshToken, 'refresh-token');
    assert.equal(stored?.email, 'n@example.com');
    assert.equal(stored?.chatgptAccountId, 'acc-test');
    assert.equal(stored?.chatgptPlanType, 'plus');
    const configFile = await readFile(join(process.env.ZEROCLAW_HOME!, 'zeroclaw.json'), 'utf8');
    assert.equal(configFile.includes('access-token'), false);
    assert.equal(configFile.includes('refresh-token'), false);
    assert.equal(JSON.parse(configFile).provider.credentialRef, 'oauth:openai');
  } finally {
    await app.close();
    globalThis.fetch = oldFetch;
    if (oldHome === undefined) delete process.env.ZEROCLAW_HOME; else process.env.ZEROCLAW_HOME = oldHome;
    if (oldCallbackPort === undefined) delete process.env.ZEROCLAW_OAUTH_CALLBACK_PORT; else process.env.ZEROCLAW_OAUTH_CALLBACK_PORT = oldCallbackPort;
  }
});

test('public api oauth callback completes without bearer auth and returns dashboard handoff html', async () => {
  const oldHome = process.env.ZEROCLAW_HOME;
  const oldFetch = globalThis.fetch;
  const oldCallbackPort = process.env.ZEROCLAW_OAUTH_CALLBACK_PORT;
  process.env.ZEROCLAW_OAUTH_CALLBACK_PORT = '0';
  process.env.ZEROCLAW_HOME = await mkdtemp(join(tmpdir(), 'zeroclaw-api-oauth-callback-'));
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const target = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    if (target.startsWith('http://127.0.0.1:') || target.startsWith('http://localhost:')) return oldFetch(url, init);
    assert.equal(init?.method, 'POST');
    return new Response(JSON.stringify({ access_token: 'api-callback-token', expires_in: 3600, scope: 'openid profile email offline_access api.model.read' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const app = await createDashboardServer({ password: '123456', config: defaultConfig(), dashboardPort: 10212 });
  try {
    const login = await app.inject({ method: 'POST', url: '/api/login', headers: { 'content-type': 'application/json' }, payload: { password: '123456' } });
    const token = JSON.parse(login.body).token;
    const oauth = await app.inject({ method: 'POST', url: '/api/provider/oauth-url', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', host: '127.0.0.1:10212' }, payload: { provider: 'openai' } });
    const connectUrl = new URL(JSON.parse(oauth.body).connectUrl);
    const callback = await app.inject({ method: 'GET', url: `/api/provider/oauth/callback?state=${connectUrl.searchParams.get('state')}&code=api-code` });
    assert.equal(callback.statusCode, 200);
    assert.match(callback.body, /zeroclaw-oauth-connected/);
    assert.match(callback.body, /127\.0\.0\.1:10212\/provider\?oauth=connected/);
    assert.equal(callback.body.includes('api-callback-token'), false);
    const configFile = await readFile(join(process.env.ZEROCLAW_HOME!, 'zeroclaw.json'), 'utf8');
    assert.equal(JSON.parse(configFile).provider.credentialRef, 'oauth:openai');
  } finally {
    await app.close();
    globalThis.fetch = oldFetch;
    if (oldHome === undefined) delete process.env.ZEROCLAW_HOME; else process.env.ZEROCLAW_HOME = oldHome;
    if (oldCallbackPort === undefined) delete process.env.ZEROCLAW_OAUTH_CALLBACK_PORT; else process.env.ZEROCLAW_OAUTH_CALLBACK_PORT = oldCallbackPort;
  }
});
