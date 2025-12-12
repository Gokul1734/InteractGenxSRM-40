import React, { useMemo, useState } from 'react';
import { ArrowRight, Shield, Loader2, AlertCircle } from 'lucide-react';
import { userAPI } from '../services/api.js';

export default function AuthPage({ onLogin, onSignup }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = useMemo(() => {
    return name.trim().length > 0 && email.trim().length > 0 && !loading;
  }, [name, email, loading]);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Try to find user by email
      const response = await userAPI.getByEmail(email.trim());
      
      if (response.success && response.data) {
        const user = response.data;
        // Verify name matches (case-insensitive)
        if (user.user_name.toLowerCase() !== name.trim().toLowerCase()) {
          setError('Name does not match the registered email. Please check your credentials.');
          return;
        }
        
        // Store user in localStorage for persistence
        localStorage.setItem('user', JSON.stringify(user));
        
        onLogin?.({
          name: user.user_name,
          email: user.user_email,
          user_code: user.user_code,
          _id: user._id,
          is_active: user.is_active,
        });
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await userAPI.create(name.trim(), email.trim());
      
      if (response.success && response.data) {
        const user = response.data;
        
        // Store user in localStorage for persistence
        localStorage.setItem('user', JSON.stringify(user));
        
        onSignup?.({
          name: user.user_name,
          email: user.user_email,
          user_code: user.user_code,
          _id: user._id,
          is_active: user.is_active,
        });
      }
    } catch (err) {
      if (err.message?.includes('already registered')) {
        setError('This email is already registered. Please use Login instead.');
      } else {
        setError(err.message || 'Signup failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

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
                  CoBrowser
                </div>
                <div className="text-xl font-semibold" style={{ color: 'var(--color-text-title)' }}>
                  Login / Signup
                </div>
              </div>
            </div>

            <div className="text-3xl font-semibold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              Collaborative browser tracking,
              <span style={{ color: 'var(--color-text-title)' }}> in real-time.</span>
            </div>
            <div className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Sign in to access your dashboard. Create sessions, invite collaborators, and track browser activity together.
            </div>

            {/* Features list */}
            <div className="mt-6 space-y-3">
              {[
                'Create and manage collaborative sessions',
                'Invite team members with unique user codes',
                'Real-time navigation tracking across browsers',
                'Live updates from all session participants',
              ].map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <div 
                    className="h-1.5 w-1.5 rounded-full" 
                    style={{ background: 'var(--color-primary)' }}
                  />
                  {feature}
                </div>
              ))}
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
            {/* Error message */}
            {error && (
              <div 
                className="mb-5 flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
                style={{
                  background: 'rgba(220, 38, 38, 0.1)',
                  border: '1px solid rgba(220, 38, 38, 0.3)',
                  color: 'var(--color-error-text)',
                }}
              >
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  disabled={loading}
                  className="w-full rounded-lg px-4 py-3.5 text-sm outline-none transition-colors"
                  style={{
                    background: 'var(--color-surface-dark)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                    opacity: loading ? 0.6 : 1,
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleLogin()}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  disabled={loading}
                  className="w-full rounded-lg px-4 py-3.5 text-sm outline-none transition-colors"
                  style={{
                    background: 'var(--color-surface-dark)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                    opacity: loading ? 0.6 : 1,
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleLogin()}
                />
              </div>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleLogin}
                className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-all"
                style={{
                  background: canSubmit ? 'transparent' : 'var(--color-surface-dark)',
                  color: canSubmit ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  border: '1px solid',
                  borderColor: canSubmit ? 'var(--color-border-hover)' : 'var(--color-border)',
                  opacity: canSubmit ? 1 : 0.6,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Login'}
              </button>

              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleSignup}
                className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-all"
                style={{
                  background: canSubmit ? 'var(--color-primary)' : 'var(--color-surface-dark)',
                  color: canSubmit ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  border: '1px solid',
                  borderColor: canSubmit ? 'var(--color-primary-border)' : 'var(--color-border)',
                  opacity: canSubmit ? 1 : 0.6,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : (
                  <>
                    Signup
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>

            <div className="mt-5 text-center text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Use <span style={{ color: 'var(--color-text-secondary)' }}>Login</span> for existing accounts, 
              {' '}<span style={{ color: 'var(--color-text-secondary)' }}>Signup</span> to create a new one.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
