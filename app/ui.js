import { fmtMoney } from '@/lib/format';

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 32 32"><path d="M9 8h4v13h10v3H9z" fill="var(--accent-ink)" /><path d="M15 15h8v3h-8z" fill="var(--accent-ink)" opacity=".7" /></svg>
    </span>
  );
}

export function PageHead({ eyebrow, title, children }) {
  return (
    <div className="page-head">
      <div className="title">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
      </div>
      {children && <div className="actions">{children}</div>}
    </div>
  );
}

export function Flash({ searchParams }) {
  if (searchParams?.error) return <p className="flash error" role="alert">{String(searchParams.error)}</p>;
  if (searchParams?.ok) return <p className="flash ok" role="status">{String(searchParams.ok)}</p>;
  if (searchParams?.denied) return <p className="flash error" role="alert">Your role does not have access to that page or action.</p>;
  return null;
}

const STATUS_LABEL = {
  draft: 'Draft', confirmed: 'Confirmed', shipped: 'Shipped · unpaid', paid: 'Paid', cancelled: 'Cancelled',
  ordered: 'Ordered', received: 'Received', ok: 'In stock', low: 'Low stock', out: 'Out of stock',
};

export function Badge({ status }) {
  return <span className={`badge ${status}`}>{STATUS_LABEL[status] || status}</span>;
}

export function Money({ cents, currency }) {
  return <span className="mono">{fmtMoney(cents, currency)}</span>;
}

export function Flow({ steps, current }) {
  const at = steps.indexOf(current);
  return (
    <div className="flow" aria-label={`Status: ${current}`}>
      {steps.map((s, i) => (
        <span key={s} className={i < at ? 'done' : i === at ? 'now' : ''}>{STATUS_LABEL[s] || s}</span>
      ))}
    </div>
  );
}
