import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
// Fixed parameters also bound the CPU/memory cost of each verification.
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const validHash = value => /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(value ?? '');

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64, options);
  return `scrypt:${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password, storedHash) {
  if (!validHash(storedHash)) return false;
  const [, salt, expected] = storedHash.split(':');
  const actual = await derive(password, salt, 64, options);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
