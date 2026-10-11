// Format and generation of classroom join codes (classes.class_code).

export const CLASS_CODE_LENGTH = 6;
export const CLASS_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const CLASS_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export type RandomInt = (maxExclusive: number) => number;

/** Trims and uppercases a raw code; does not strip invalid characters. */
export function normalizeClassCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidClassCode(code: string): boolean {
  return CLASS_CODE_PATTERN.test(code);
}

/** Uniform integer in [0, maxExclusive) using rejection sampling to avoid modulo bias. */
export function cryptoRandomInt(maxExclusive: number): number {
  const limit = Math.floor(256 / maxExclusive) * maxExclusive;
  const byte = new Uint8Array(1);
  do {
    crypto.getRandomValues(byte);
  } while (byte[0] >= limit);
  return byte[0] % maxExclusive;
}

export function randomClassCode(randomInt: RandomInt = cryptoRandomInt): string {
  let code = "";
  for (let i = 0; i < CLASS_CODE_LENGTH; i++) {
    code += CLASS_CODE_ALPHABET[randomInt(CLASS_CODE_ALPHABET.length)];
  }
  return code;
}
