import { base64UrlEncode } from './encoding';

const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

export const generateState = (): string => base64UrlEncode(randomBytes(16));

export const generateCodeVerifier = (): string => base64UrlEncode(randomBytes(32));

export const generateCodeChallenge = async (codeVerifier: string): Promise<string> => {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
};


