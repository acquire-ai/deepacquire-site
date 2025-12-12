export type SameSite = 'Lax' | 'Strict' | 'None';

export type CookieOptions = {
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: SameSite;
  maxAge?: number;
};

export const parseCookies = (cookieHeader: string | null | undefined): Record<string, string> => {
  if (!cookieHeader) return {};

  const out: Record<string, string> = {};
  const parts = cookieHeader.split(';');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!name) continue;

    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }

  return out;
};

export const serializeCookie = (name: string, value: string, options: CookieOptions = {}): string => {
  const parts: string[] = [];

  parts.push(`${name}=${encodeURIComponent(value)}`);

  if (options.path) parts.push(`Path=${options.path}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);

  return parts.join('; ');
};

export const deleteCookie = (name: string, options: Pick<CookieOptions, 'path' | 'secure' | 'sameSite'> = {}): string =>
  serializeCookie(name, '', {
    ...options,
    path: options.path ?? '/',
    maxAge: 0,
  });
