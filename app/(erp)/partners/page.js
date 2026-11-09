import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { listPartners } from '@/lib/queries';
import { createPartner } from '../../actions';
import { Flash, PageHead } from '../../ui';

export const metadata = { title: 'Customers & suppliers' };

export default async function Partners({ searchParams }) {
  const user = await requireUser();
  const kind = searchParams.kind === 'supplier' ? 'supplier' : 'customer';
  const list = await listPartners(kind);
  const label = kind === 'supplier' ? 'Supplier' : 'Customer';

  return (
    <>
      <PageHead eyebrow="Directory" title="Customers and suppliers" />
      <Flash searchParams={searchParams} />
      <div className="grid-2">
        <section className="panel">
          <div className="toolbar">
            <div className="tabs">
              <Link href="/partners?kind=customer" aria-current={kind === 'customer' ? 'true' : undefined}>Customers</Link>
              <Link href="/partners?kind=supplier" aria-current={kind === 'supplier' ? 'true' : undefined}>Suppliers</Link>
            </div>
          </div>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>{label}</th><th>Contact</th><th>City</th><th className="num">{kind === 'supplier' ? 'POs' : 'Orders'}</th></tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td className="strong">{p.name}</td>
                    <td>{p.contact}<span className="sub">{p.email}{p.phone ? ` · ${p.phone}` : ''}</span></td>
                    <td>{p.city}</td>
                    <td className="num">{p.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {can(user.role, 'partners.edit') && (
          <form action={createPartner} className="panel">
            <div className="panel-head"><h2>Add a {label.toLowerCase()}</h2></div>
            <div className="panel-body stack">
              <input type="hidden" name="kind" value={kind} />
              <label className="f">Company name<input name="name" type="text" required /></label>
              <label className="f">Contact person<input name="contact" type="text" /></label>
              <div className="form-grid">
                <label className="f">Email<input name="email" type="email" /></label>
                <label className="f">Phone<input name="phone" type="text" /></label>
              </div>
              <label className="f">City<input name="city" type="text" /></label>
              <div><button className="btn btn-primary" type="submit">Add {label.toLowerCase()}</button></div>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
