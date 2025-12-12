const bytesToBinaryString = (bytes: Uint8Array): string => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return binary;
};

export const base64Encode = (bytes: Uint8Array): string => {
  // Cloudflare Workers and modern Node expose `btoa`.
  if (typeof btoa === 'function') return btoa(bytesToBinaryString(bytes));

  // Fallback for older Node.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');

  throw new Error('No base64 encoder available in this runtime.');
};

export const base64UrlEncode = (bytes: Uint8Array): string =>
  base64Encode(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

export const base64EncodeString = (value: string): string => base64Encode(new TextEncoder().encode(value));


