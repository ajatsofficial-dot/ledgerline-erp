import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { getSettings } from '@/lib/queries';
import { BrandMark } from '../ui';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in' };

export default async function LoginPage() {
  if (await currentUser()) redirect('/');
  const settings = await getSettings();
  const demo = process.env.DEMO_MODE === 'true';
  return (
    <main className="login">
      <section className="login-art">
        <div className="brand" style={{ padding: 0 }}>
          <BrandMark />
          <span><b>Ledgerline</b><small>{settings.company_name}</small></span>
        </div>
        <div style={{ display: 'grid', gap: 18 }}>
          <h1>Stock, orders and invoices in one place.</h1>
          <ul>
            <li>Live stock with reserved and incoming quantities</li>
            <li>Sales orders from draft to paid, with printable invoices</li>
            <li>Purchase orders that update moving average cost</li>
            <li>Roles for admin, sales and warehouse staff</li>
          </ul>
        </div>
        <span className="eyebrow" style={{ color: 'var(--side-muted)' }}>{demo ? 'Demo company · sample data' : settings.company_name}</span>
      </section>
      <section className="login-form">
        <div style={{ display: 'grid', justifyItems: 'center', width: '100%' }}>
          <LoginForm demoPassword={demo ? process.env.DEMO_PASSWORD || 'demo1234' : null} />
        </div>
      </section>
    </main>
  );
}
