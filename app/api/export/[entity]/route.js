import { currentUser } from '@/lib/auth';
import { exportRows } from '@/lib/queries';
import { todayIso } from '@/lib/format';

export const dynamic = 'force-dynamic';

const cell = (v) => {
  const s = v == null ? '' : String(v);
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

export async function GET(_req, { params }) {
  if (!(await currentUser())) return new Response('Sign in first.', { status: 401 });
  const data = await exportRows(params.entity);
  if (!data) return new Response('Unknown export.', { status: 404 });
  const header = data.length ? Object.keys(data[0]) : [];
  const csv = [header, ...data.map((r) => header.map((h) => r[h]))].map((r) => r.map(cell).join(',')).join('\r\n');
  return new Response('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ledgerline-${params.entity}-${todayIso()}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
