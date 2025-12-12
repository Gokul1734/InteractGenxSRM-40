import React, { useMemo, useState } from 'react';
import { ArrowRight, Shield } from 'lucide-react';

export default function AuthPage({ onLogin, onSignup }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const canSubmit = useMemo(() => {
    return name.trim().length > 0 && email.trim().length > 0;
  }, [name, email]);

  return (
    <div
      className="min-h-screen px-6 py-10 flex items-center justify-center"
      style={{ background: 'var(--color-background)' }}
    >
      <div className="mx-auto w-full max-w-5xl">
        <div className="grid items-center gap-8 md:grid-cols-2">
          {/* Left: Bigger header / branding */}
          <div className="px-1">
            <div className="mb-5 flex items-center gap-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-xl"
                style={{
                  background: 'var(--color-surface-dark)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <Shield size={22} style={{ color: 'var(--color-text-primary)' }} />
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  InteractGenx
                </div>
                <div className="text-xl font-semibold" style={{ color: 'var(--color-text-title)' }}>
                  Login / Signup
                </div>
              </div>
            </div>

            <div className="text-3xl font-semibold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              Professional navigation tracking,
              <span style={{ color: 'var(--color-text-title)' }}> built for clarity.</span>
            </div>
            <div className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Sign in to access the dashboard. Use Signup to create a new user record later when backend auth is wired.
            </div>
          </div>

          {/* Right: Form */}
          <div
            className="rounded-2xl p-8"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-lg px-4 py-3.5 text-sm outline-none"
                  style={{
                    background: 'var(--color-surface-dark)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Email
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-lg px-4 py-3.5 text-sm outline-none"
                  style={{
                    background: 'var(--color-surface-dark)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => onLogin?.({ name: name.trim(), email: email.trim() })}
                className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium"
                style={{
                  background: canSubmit ? 'transparent' : 'var(--color-surface-dark)',
                  color: canSubmit ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  border: '1px solid',
                  borderColor: canSubmit ? 'var(--color-border-hover)' : 'var(--color-border)',
                  opacity: canSubmit ? 1 : 0.6,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                }}
              >
                Login
              </button>

              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => onSignup?.({ name: name.trim(), email: email.trim() })}
                className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium"
                style={{
                  background: canSubmit ? 'var(--color-primary)' : 'var(--color-surface-dark)',
                  color: canSubmit ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  border: '1px solid',
                  borderColor: canSubmit ? 'var(--color-primary-border)' : 'var(--color-border)',
                  opacity: canSubmit ? 1 : 0.6,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                }}
              >
                Signup
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


