import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { secretsPath } from '../../shared/paths.js';

const SecretNameSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);
const SecretRefSchema = z.string().regex(/^secret:[A-Za-z_][A-Za-z0-9_]*$/);
const OAuthRefSchema = z.string().regex(/^oauth:[A-Za-z0-9._-]+$/);
const StoredCredentialRefSchema = z.string().regex(/^(secret:[A-Za-z_][A-Za-z0-9_]*|oauth:[A-Za-z0-9._-]+)$/);

export const OAuthCredentialSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  expiresAt: z.string().optional(),
  scope: z.string().optional(),
  idToken: z.string().optional(),
  email: z.string().optional(),
  chatgptAccountId: z.string().optional(),
  chatgptPlanType: z.string().optional(),
  updatedAt: z.string().optional()
}).passthrough();

export const SecretsFileSchema = z.object({
  version: z.literal(1).default(1),
  secrets: z.record(z.string(), z.string()).default({}),
  oauth: z.record(z.string(), OAuthCredentialSchema).default({})
}).prefault({});

export type OAuthCredential = z.infer<typeof OAuthCredentialSchema>;
export type SecretsFile = z.infer<typeof SecretsFileSchema>;

function refName(ref: string, prefix: 'secret' | 'oauth'): string { return ref.slice(prefix.length + 1); }
async function writeSecrets(file: SecretsFile): Promise<void> { const path = secretsPath(); await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(file, null, 2) + '\n', { mode: 0o600 }); }
export async function loadSecrets(): Promise<SecretsFile> { const path = secretsPath(); if (!existsSync(path)) return SecretsFileSchema.parse({}); const raw = await readFile(path, 'utf8'); return SecretsFileSchema.parse(JSON.parse(raw)); }
export async function saveSecret(ref: string, value: string): Promise<void> { SecretRefSchema.parse(ref); const name = SecretNameSchema.parse(refName(ref, 'secret')); const file = await loadSecrets(); file.secrets[name] = value; await writeSecrets(file); }
export async function resolveSecretRef(ref: string): Promise<string | undefined> { SecretRefSchema.parse(ref); const file = await loadSecrets(); return file.secrets[refName(ref, 'secret')]; }
export async function saveOAuthCredential(provider: string, credential: OAuthCredential): Promise<void> { const safeProvider = z.string().regex(/^[A-Za-z0-9._-]+$/).parse(provider); const file = await loadSecrets(); file.oauth[safeProvider] = { ...OAuthCredentialSchema.parse(credential), updatedAt: new Date().toISOString() }; await writeSecrets(file); }
export async function resolveOAuthCredential(ref: string): Promise<OAuthCredential | undefined> { OAuthRefSchema.parse(ref); const file = await loadSecrets(); return file.oauth[refName(ref, 'oauth')]; }
export async function deleteSecretRef(ref: string): Promise<void> { SecretRefSchema.parse(ref); const file = await loadSecrets(); delete file.secrets[refName(ref, 'secret')]; await writeSecrets(file); }
export async function deleteOAuthCredential(ref: string): Promise<void> { OAuthRefSchema.parse(ref); const file = await loadSecrets(); delete file.oauth[refName(ref, 'oauth')]; await writeSecrets(file); }
export async function deleteStoredCredential(ref: string): Promise<void> { StoredCredentialRefSchema.parse(ref); if (ref.startsWith('oauth:')) return deleteOAuthCredential(ref); return deleteSecretRef(ref); }
export function isOAuthCredentialExpired(credential: OAuthCredential, now = new Date()): boolean { return Boolean(credential.expiresAt && Number.isFinite(Date.parse(credential.expiresAt)) && Date.parse(credential.expiresAt) <= now.getTime()); }
export function secretStatus(file: SecretsFile) { return { secrets: Object.fromEntries(Object.keys(file.secrets).map((key) => [key, { configured: true }])), oauth: Object.fromEntries(Object.entries(file.oauth).map(([key, value]) => [key, { connected: Boolean(value.accessToken), status: !value.accessToken || isOAuthCredentialExpired(value) ? 'invalid' : 'connected', expiresAt: value.expiresAt, email: value.email, updatedAt: value.updatedAt }])) }; }
