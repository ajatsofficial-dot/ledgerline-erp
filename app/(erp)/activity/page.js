import { requireUser } from '@/lib/auth';
import { listAudit } from '@/lib/queries';
import { fmtDateTime } from '@/lib/format';
import { PageHead } from '../../ui';

export const metadata = { title: 'Activity log' };

export default async function Activity() {
  await requireUser('audit.view');
  const log = await listAudit(150);
  return (
    <>
      <PageHead eyebrow="Admin" title="Activity log" />
      <p className="muted">Every change to products, stock, orders and users is recorded here with who made it.</p>
      <section className="panel">
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Detail</th></tr></thead>
            <tbody>
              {log.map((a) => (
                <tr key={a.id}>
                  <td className="mono" style={{ fontSize: '.85rem', whiteSpace: 'nowrap' }}>{fmtDateTime(a.created_at)}</td>
                  <td>{a.user_name || 'System'}</td>
                  <td className="strong">{a.action}</td>
                  <td>{a.entity}</td>
                  <td className="muted">{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
