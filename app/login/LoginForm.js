'use client';

import { useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { login } from '../actions';

const DEMO_USERS = [
  ['admin@kestrel.demo', 'Administrator', 'Everything, including users and audit log'],
  ['sales@kestrel.demo', 'Sales', 'Customers, sales orders, payments'],
  ['warehouse@kestrel.demo', 'Warehouse', 'Products, stock, purchasing, shipping'],
];

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>;
}

export default function LoginForm({ demoPassword }) {
  const [state, action] = useFormState(login, null);
  const email = useRef(null);
  const password = useRef(null);
  return (
    <>
      <form action={action}>
        <div style={{ display: 'grid', gap: 4 }}>
          <span className="eyebrow">Ledgerline ERP</span>
          <h2 style={{ fontSize: '1.6rem' }}>Sign in</h2>
        </div>
        <label className="f">Work email<input ref={email} name="email" type="email" autoComplete="username" required /></label>
        <label className="f">Password<input ref={password} name="password" type="password" autoComplete="current-password" required /></label>
        {state?.error && <p className="flash error" role="alert">{state.error}</p>}
        <Submit />
      </form>
      {demoPassword && (
        <div className="demo-users">
          <span className="eyebrow">Demo logins · password {demoPassword}</span>
          {DEMO_USERS.map(([mail, role, scope]) => (
            <button
              key={mail}
              type="button"
              onClick={() => { email.current.value = mail; password.current.value = demoPassword; }}
              title={scope}
            >
              <span><b>{role}</b> <span className="muted">· {scope}</span></span>
              <span className="mono muted">{mail.split('@')[0]}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
