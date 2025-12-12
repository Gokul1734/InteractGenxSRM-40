import React, { useState } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { sessionAPI } from '../services/api.js';

export default function CreateSessionModal({ user, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = description.trim().length > 0 && !loading;

  const handleCreate = async () => {
    if (!canSubmit) return;
    
    setLoading(true);
    setError('');

    try {
      const response = await sessionAPI.create(
        name.trim() || undefined,
        description.trim(),
        user.user_code
      );

      if (response.success && response.data) {
        onCreated?.(response.data);
        onClose?.();
      }
    } catch (err) {
      setError(err.message || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div 
        className="w-full max-w-lg rounded-2xl p-6"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-title)' }}>
              Create New Session
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Start a collaborative tracking session
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-opacity-80"
            style={{ 
              background: 'var(--color-surface-dark)',
              color: 'var(--color-text-secondary)' 
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div 
            className="mb-4 px-4 py-3 rounded-lg text-sm"
            style={{
              background: 'rgba(220, 38, 38, 0.1)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              color: 'var(--color-error-text)',
            }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label 
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Session Name <span style={{ color: 'var(--color-text-tertiary)' }}>(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Research Session Alpha"
              disabled={loading}
              className="w-full rounded-lg px-4 py-3 text-sm outline-none"
              style={{
                background: 'var(--color-surface-dark)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <div>
            <label 
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Description <span style={{ color: 'var(--color-error-text)' }}>*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose of this session..."
              disabled={loading}
              rows={3}
              className="w-full rounded-lg px-4 py-3 text-sm outline-none resize-none"
              style={{
                background: 'var(--color-surface-dark)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
        </div>

        {/* Info */}
        <div 
          className="mt-4 px-4 py-3 rounded-lg text-sm"
          style={{
            background: 'var(--color-surface-dark)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <strong style={{ color: 'var(--color-text-primary)' }}>Your User Code:</strong>{' '}
          <code 
            className="px-2 py-0.5 rounded text-xs"
            style={{ 
              background: 'var(--color-surface-light)',
              color: 'var(--color-text-title)' 
            }}
          >
            {user.user_code}
          </code>
          <span className="ml-2">(You will be the session creator)</span>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: canSubmit ? 'var(--color-primary)' : 'var(--color-surface-dark)',
              border: '1px solid',
              borderColor: canSubmit ? 'var(--color-primary-border)' : 'var(--color-border)',
              color: canSubmit ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <Plus size={16} />
                Create Session
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

