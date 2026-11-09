export function fmtMoney(cents, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format((Number(cents) || 0) / 100);
}

export function fmtMoneyShort(cents, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format((Number(cents) || 0) / 100);
}

export function fmtNumber(n) {
  return new Intl.NumberFormat('en-US').format(Number(n) || 0);
}

export function fmtDate(iso, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function fmtDateTime(sqlUtc) {
  if (!sqlUtc) return '—';
  const d = new Date(String(sqlUtc).replace(' ', 'T') + 'Z');
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(d) + ' UTC';
}

export function todayIso(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function addDaysIso(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** "12.50" or "12" -> 1250 cents. Returns NaN for invalid input. */
export function toCents(value) {
  const s = String(value ?? '').trim().replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(Number(s) * 100);
}
