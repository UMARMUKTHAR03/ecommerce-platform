'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth.context';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/account';

  const { register, isAuthenticated } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(redirectUrl);
    }
  }, [isAuthenticated, redirectUrl, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!name.trim()) {
      setError('Please provide your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Please provide a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await register(name.trim(), email.trim(), password, phone.trim() || undefined);
      router.push(redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please check your information.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-outline bg-panel p-7 shadow-soft">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-brand">Get Started</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-fg">Create your account</h1>
        {redirectUrl.startsWith('/checkout') ? (
          <p className="mt-1 text-xs text-brand">Create an account to complete your checkout.</p>
        ) : null}
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="name" className="text-xs uppercase tracking-wide text-muted">
            Full name *
          </label>
          <input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            autoComplete="name"
            placeholder="Alexander Wright"
            className="h-11 w-full rounded-xl border border-outline bg-bg-elevated px-3 text-sm text-fg focus:border-brand focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-xs uppercase tracking-wide text-muted">
            Email *
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            placeholder="name@example.com"
            className="h-11 w-full rounded-xl border border-outline bg-bg-elevated px-3 text-sm text-fg focus:border-brand focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="phone" className="text-xs uppercase tracking-wide text-muted">
            Phone (optional)
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            placeholder="+880 1700 000000"
            className="h-11 w-full rounded-xl border border-outline bg-bg-elevated px-3 text-sm text-fg focus:border-brand focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-xs uppercase tracking-wide text-muted">
            Password (min 8 chars) *
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
            placeholder="••••••••"
            className="h-11 w-full rounded-xl border border-outline bg-bg-elevated px-3 text-sm text-fg focus:border-brand focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-xs uppercase tracking-wide text-muted">
            Confirm Password *
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
            placeholder="••••••••"
            className="h-11 w-full rounded-xl border border-outline bg-bg-elevated px-3 text-sm text-fg focus:border-brand focus:outline-none"
          />
        </div>

        {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-fg px-4 py-3 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link
          href={`/auth/login${redirectUrl ? `?redirect=${encodeURIComponent(redirectUrl)}` : ''}`}
          className="font-medium text-fg underline hover:text-brand"
        >
          Log in here
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="py-14 text-center text-sm text-muted">Loading registration form...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
