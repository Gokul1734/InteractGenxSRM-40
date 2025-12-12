import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Clock, User, Check, X, Loader2, RefreshCw, Mail } from 'lucide-react';
import { invitationAPI } from '../services/api.js';

export default function InvitationsPanel({ user, onAccept, onViewSession }) {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null);
  const [error, setError] = useState('');

  const fetchInvitations = useCallback(async () => {
    try {
      const response = await invitationAPI.getPending(user.user_code);
      setInvitations(response.data || []);
      setError('');
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
      setError('Failed to load invitations');
    } finally {
      setLoading(false);
    }
  }, [user.user_code]);

  useEffect(() => {
    fetchInvitations();
    // Poll for new invitations every 30 seconds
    const interval = setInterval(fetchInvitations, 30000);
    return () => clearInterval(interval);
  }, [fetchInvitations]);

  const handleAccept = async (invitation) => {
    setResponding(invitation.invitation_id);
    try {
      const response = await invitationAPI.accept(invitation.invitation_id, user.user_code);
      if (response.success) {
        setInvitations(prev => prev.filter(i => i.invitation_id !== invitation.invitation_id));
        onAccept?.(response.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to accept invitation');
    } finally {
      setResponding(null);
    }
  };

  const handleDecline = async (invitation) => {
    setResponding(invitation.invitation_id);
    try {
      await invitationAPI.decline(invitation.invitation_id, user.user_code);
      setInvitations(prev => prev.filter(i => i.invitation_id !== invitation.invitation_id));
    } catch (err) {
      setError(err.message || 'Failed to decline invitation');
    } finally {
      setResponding(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div 
        className="rounded-xl p-6 text-center"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <Loader2 
          size={24} 
          className="animate-spin mx-auto mb-3"
          style={{ color: 'var(--color-text-tertiary)' }}
        />
        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Loading invitations...
        </div>
      </div>
    );
  }

  return (
    <div 
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-3">
          <div 
            className="p-2 rounded-lg"
            style={{ background: 'var(--color-surface-dark)' }}
          >
            <Mail size={18} style={{ color: 'var(--color-user-purple)' }} />
          </div>
          <div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-title)' }}>
              Pending Invitations
            </h3>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {invitations.length} invitation{invitations.length !== 1 ? 's' : ''} waiting
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            fetchInvitations();
          }}
          className="p-2 rounded-lg transition-colors"
          style={{ 
            background: 'var(--color-surface-dark)',
            color: 'var(--color-text-secondary)' 
          }}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div 
          className="mx-4 mt-4 px-4 py-3 rounded-lg text-sm"
          style={{
            background: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            color: 'var(--color-error-text)',
          }}
        >
          {error}
        </div>
      )}

      {/* Invitations list */}
      {invitations.length === 0 ? (
        <div className="p-8 text-center">
          <Bell 
            size={32} 
            className="mx-auto mb-3"
            style={{ color: 'var(--color-text-tertiary)' }}
          />
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            No pending invitations
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            You'll see session invites here
          </p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {invitations.map((invitation) => (
            <div key={invitation.invitation_id} className="p-4">
              {/* Session info */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h4 
                    className="text-sm font-semibold truncate"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {invitation.session?.session_name || 'Unnamed Session'}
                  </h4>
                  <code 
                    className="text-xs px-1.5 py-0.5 rounded mt-1 inline-block"
                    style={{ 
                      background: 'var(--color-surface-dark)',
                      color: 'var(--color-text-tertiary)' 
                    }}
                  >
                    {invitation.session?.session_code}
                  </code>
                </div>
                <div 
                  className="flex items-center gap-1 text-xs"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  <Clock size={12} />
                  {formatDate(invitation.created_at)}
                </div>
              </div>

              {/* Inviter info */}
              <div 
                className="flex items-center gap-2 mb-3 text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <User size={14} />
                <span>
                  From: <span style={{ color: 'var(--color-text-primary)' }}>
                    {invitation.invited_by?.user_name || invitation.invited_by?.user_code}
                  </span>
                </span>
              </div>

              {/* Message */}
              {invitation.message && (
                <div 
                  className="mb-3 p-3 rounded-lg text-sm italic"
                  style={{ 
                    background: 'var(--color-surface-dark)',
                    color: 'var(--color-text-secondary)' 
                  }}
                >
                  "{invitation.message}"
                </div>
              )}

              {/* Description */}
              {invitation.session?.session_description && (
                <p 
                  className="text-xs mb-4 line-clamp-2"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  {invitation.session.session_description}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleAccept(invitation)}
                  disabled={responding === invitation.invitation_id}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium"
                  style={{
                    background: 'var(--color-primary)',
                    border: '1px solid var(--color-primary-border)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {responding === invitation.invitation_id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <>
                      <Check size={14} />
                      Accept & Join
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleDecline(invitation)}
                  disabled={responding === invitation.invitation_id}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium"
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(220, 38, 38, 0.3)',
                    color: 'var(--color-error-text)',
                  }}
                >
                  <X size={14} />
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

