import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';

const KEYLEN = 32;

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, KEYLEN, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key))));
}

/** Returns "scrypt$<salt>$<hash>" (hex). */
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scryptAsync(String(password), salt);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, salt, hex] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !hex) return false;
  const key = await scryptAsync(String(password), salt);
  const expected = Buffer.from(hex, 'hex');
  return expected.length === key.length && timingSafeEqual(key, expected);
}
