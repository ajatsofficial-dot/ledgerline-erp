import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { conn, rows } from './db.js';
import { can } from './permissions.js';

export const SESSION_COOKIE = 'll_session';
const SESSION_HOURS = 10;
const enc = new TextEncoder();

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET must be at least 32 characters in production.');
  return 'dev-only-secret-change-me-dev-only-secret';
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

async function sign(data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}

function same(a, b) {
  const x = enc.encode(a), y = enc.encode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

export async function createSession(userId) {
  const body = b64url(JSON.stringify({ uid: userId, exp: Date.now() + SESSION_HOURS * 3600e3 }));
  cookies().set(SESSION_COOKIE, `${body}.${await sign(body)}`, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SESSION_HOURS * 3600,
  });
}

export function destroySession() {
  cookies().delete(SESSION_COOKIE);
}

async function sessionUserId() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!same(sig, await sign(body))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    return data.exp > Date.now() ? Number(data.uid) : null;
  } catch {
    return null;
  }
}

/** The signed-in, active user, or null. */
export async function currentUser() {
  const id = await sessionUserId();
  if (!id) return null;
  const [u] = rows(await (await conn()).execute({ sql: 'SELECT id, email, name, role FROM users WHERE id = ? AND active = 1', args: [id] }));
  return u || null;
}

/** Use in pages and actions: sends visitors to sign in, and blocks roles without permission. */
export async function requireUser(action) {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (action && !can(user.role, action)) redirect('/?denied=1');
  return user;
}
