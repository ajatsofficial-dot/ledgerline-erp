import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ maxWidth: 480, margin: '12vh auto', padding: '0 18px', display: 'grid', gap: 14 }}>
      <span className="eyebrow">404</span>
      <h1>That record doesn't exist.</h1>
      <p className="muted">It may have been removed, or the link is wrong.</p>
      <div><Link className="btn btn-primary" href="/">Go to the dashboard</Link></div>
    </main>
  );
}
