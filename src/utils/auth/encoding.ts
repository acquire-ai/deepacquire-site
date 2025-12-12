const bytesToBinaryString = (bytes: Uint8Array): string => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return binary;
};

const binaryStringToBytes = (binary: string): Uint8Array => {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export const base64Encode = (bytes: Uint8Array): string => {
  // Cloudflare Workers and modern Node expose `btoa`.
  if (typeof btoa === 'function') return btoa(bytesToBinaryString(bytes));

  // Fallback for older Node.
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');

  throw new Error('No base64 encoder available in this runtime.');
};

export const base64Decode = (value: string): Uint8Array => {
  // Cloudflare Workers and modern Node expose `atob`.
  if (typeof atob === 'function') return binaryStringToBytes(atob(value));

  // Fallback for older Node.
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64'));

  throw new Error('No base64 decoder available in this runtime.');
};

export const base64UrlEncode = (bytes: Uint8Array): string =>
  base64Encode(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

export const base64EncodeString = (value: string): string => base64Encode(new TextEncoder().encode(value));

export const base64UrlEncodeString = (value: string): string => base64UrlEncode(new TextEncoder().encode(value));

export const base64UrlDecode = (value: string): Uint8Array => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return base64Decode(padded);
};

export const base64UrlDecodeToString = (value: string): string => new TextDecoder().decode(base64UrlDecode(value));
