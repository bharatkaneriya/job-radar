'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Alert } from './ui';
import GoogleButton from './GoogleButton';

// Only same-site paths are allowed as a post-login redirect.
const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') ? n : null);

export default function AuthForm({ mode }) {
  const signup = mode === 'signup';
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const done = (res) => router.replace(res.profileCompleted ? next || '/dashboard' : '/profile?welcome=1');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      done(await api(signup ? '/auth/register' : '/auth/login', { method: 'POST', body: signup ? form : { email: form.email, password: form.password } }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const google = async (credential) => {
    setError('');
    try {
      done(await api('/auth/google', { method: 'POST', body: { credential } }));
    } catch (err) {
      setError(err.message);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="card w-full max-w-md p-8">
      <h1 className="text-2xl font-semibold text-slate-900">{signup ? 'Create your account' : 'Welcome back'}</h1>
      <p className="mt-1 text-sm text-slate-500">{signup ? 'Set up your profile next and get matched jobs.' : 'Log in to see your matches.'}</p>

      <div className="mt-6">
        <GoogleButton onCredential={google} text={signup ? 'signup_with' : 'signin_with'} />
      </div>
      {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
        <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          or with email
          <div className="h-px flex-1 bg-slate-200" />
        </div>
      )}

      <form onSubmit={submit} className="mt-4 space-y-4">
        {signup && (
          <div>
            <label className="label" htmlFor="name">
              Name
            </label>
            <input id="name" className="input" value={form.name} onChange={set('name')} required autoComplete="name" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" type="email" className="input" value={form.email} onChange={set('email')} required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="input"
            value={form.password}
            onChange={set('password')}
            required
            minLength={signup ? 8 : undefined}
            autoComplete={signup ? 'new-password' : 'current-password'}
          />
          {signup && <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>}
        </div>
        <Alert>{error}</Alert>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Please wait…' : signup ? 'Create account' : 'Log in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        {signup ? 'Already have an account? ' : 'New here? '}
        <Link href={signup ? '/login' : '/signup'} className="font-medium text-brand-600 hover:underline">
          {signup ? 'Log in' : 'Create an account'}
        </Link>
      </p>
    </div>
  );
}
