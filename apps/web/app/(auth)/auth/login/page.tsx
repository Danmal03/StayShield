'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
        }),
      });
      if (!response.ok) {
        setError(response.status === 401 ? 'Email or password is incorrect.' : 'Unable to sign in. Try again shortly.');
        return;
      }
      router.push('/app/dashboard');
    } catch {
      setError('StayShield could not reach the API. Check that the services are running.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <a className="brand" href="/">StayShield</a>
        <p className="eyebrow">SECURE ACCESS</p>
        <h1 id="login-title">Welcome back</h1>
        <p className="muted">Sign in with your invited staff account.</p>
        <form onSubmit={submit}>
          <label htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" autoComplete="username" required maxLength={254} />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={128} />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button primary full" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="privacy-note">Accounts are provisioned by your StayShield administrator. Public registration is disabled.</p>
      </section>
    </main>
  );
}
