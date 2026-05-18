import { describe, expect, it, beforeAll, vi } from 'vitest';
import { generateKeyPair, SignJWT, type KeyLike } from 'jose';

import { verifySession, SITE_SESSION_AUDIENCE, SITE_SESSION_ISSUER, type SessionVerifierConfig } from './logto';

// jose 5.10 calls node:https directly inside `createRemoteJWKSet`, so we replace the
// resolver with one that returns the freshly-generated public key. This keeps the
// test hermetic and avoids any network access. `vi.mock` is hoisted to the top of
// the file at runtime regardless of where it is written.
vi.mock('jose', async () => {
  const actual = await vi.importActual<typeof import('jose')>('jose');
  return {
    ...actual,
    createRemoteJWKSet: () => async () => rsaPublicKey,
  };
});

const TEST_LOGTO_ISSUER = 'https://example.test/oidc';
const TEST_LOGTO_JWKS_URI = 'https://example.test/oidc/jwks';
const TEST_LOGTO_CLIENT_ID = 'test-client-id';

const HMAC_SECRET = 'test-shared-secret-must-be-long-enough-to-be-realistic-32+';

let rsaPrivateKey: KeyLike;
let rsaPublicKey: KeyLike;

const baseConfig = (): SessionVerifierConfig => ({
  logto: {
    issuer: TEST_LOGTO_ISSUER,
    jwksUri: TEST_LOGTO_JWKS_URI,
    clientId: TEST_LOGTO_CLIENT_ID,
  },
  gatewaySharedSecret: HMAC_SECRET,
});

const signRs256 = async (payload: Record<string, unknown>, opts: { kid?: string } = {}) => {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: opts.kid ?? 'test-kid' })
    .setIssuedAt()
    .setIssuer(TEST_LOGTO_ISSUER)
    .setAudience(TEST_LOGTO_CLIENT_ID)
    .setExpirationTime('1h')
    .sign(rsaPrivateKey);
};

const signHs256 = async (
  payload: Record<string, unknown>,
  opts: { issuer?: string; audience?: string; secret?: string; expSeconds?: number } = {}
) => {
  const secret = new TextEncoder().encode(opts.secret ?? HMAC_SECRET);
  const expSeconds = opts.expSeconds ?? 3600;
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(opts.issuer ?? SITE_SESSION_ISSUER)
    .setAudience(opts.audience ?? SITE_SESSION_AUDIENCE)
    .setExpirationTime(Math.floor(Date.now() / 1000) + expSeconds)
    .sign(secret);
};

describe('verifySession', () => {
  beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
    rsaPrivateKey = privateKey;
    rsaPublicKey = publicKey;
  });

  it('verifies an RS256 Logto-signed token via JWKS', async () => {
    const token = await signRs256({ sub: 'logto-user-1', email: 'a@b.com', name: 'Alice' });
    const claims = await verifySession(token, baseConfig());
    expect(claims.sub).toBe('logto-user-1');
    expect(claims.email).toBe('a@b.com');
    expect(claims.name).toBe('Alice');
  });

  it('verifies an HS256 gateway-signed site session token via HMAC', async () => {
    const token = await signHs256({
      sub: 'gw-user-1',
      email: 'gw@b.com',
      name: 'Gw',
      picture: 'https://example.test/pic.png',
    });
    const claims = await verifySession(token, baseConfig());
    expect(claims.sub).toBe('gw-user-1');
    expect(claims.email).toBe('gw@b.com');
    expect(claims.picture).toBe('https://example.test/pic.png');
    expect(claims.iss).toBe(SITE_SESSION_ISSUER);
    expect(claims.aud).toBe(SITE_SESSION_AUDIENCE);
  });

  it('rejects HS256 with wrong issuer', async () => {
    const token = await signHs256({ sub: 'x' }, { issuer: 'not-gateway-worker' });
    await expect(verifySession(token, baseConfig())).rejects.toThrow();
  });

  it('rejects HS256 with wrong audience', async () => {
    const token = await signHs256({ sub: 'x' }, { audience: 'not-site' });
    await expect(verifySession(token, baseConfig())).rejects.toThrow();
  });

  it('rejects HS256 signed with the wrong secret', async () => {
    const token = await signHs256({ sub: 'x' }, { secret: 'completely-wrong-secret-value-that-does-not-match' });
    await expect(verifySession(token, baseConfig())).rejects.toThrow();
  });

  it('rejects HS256 that has expired', async () => {
    const token = await signHs256({ sub: 'x' }, { expSeconds: -10 });
    await expect(verifySession(token, baseConfig())).rejects.toThrow();
  });

  it('rejects HS256 when GATEWAY_SHARED_SECRET is missing', async () => {
    const token = await signHs256({ sub: 'x' });
    const cfg = baseConfig();
    cfg.gatewaySharedSecret = undefined;
    await expect(verifySession(token, cfg)).rejects.toThrow(/GATEWAY_SHARED_SECRET/);
  });

  it('rejects alg=none tokens', async () => {
    // Manually craft an unsigned JWT with alg=none.
    const enc = (obj: Record<string, unknown>) =>
      btoa(JSON.stringify(obj)).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const header = enc({ alg: 'none', typ: 'JWT' });
    const payload = enc({ sub: 'x', iss: SITE_SESSION_ISSUER, aud: SITE_SESSION_AUDIENCE });
    const token = `${header}.${payload}.`;
    await expect(verifySession(token, baseConfig())).rejects.toThrow(/Unsupported JWT alg/);
  });

  it('rejects unknown algs', async () => {
    const enc = (obj: Record<string, unknown>) =>
      btoa(JSON.stringify(obj)).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const header = enc({ alg: 'XYZ123', typ: 'JWT' });
    const payload = enc({ sub: 'x' });
    const token = `${header}.${payload}.AAAA`;
    await expect(verifySession(token, baseConfig())).rejects.toThrow(/Unsupported JWT alg/);
  });
});
