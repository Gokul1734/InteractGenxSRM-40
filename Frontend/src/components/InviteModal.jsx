import React, { useState, useEffect } from 'react';
import { X, Search, UserPlus, Loader2, Check, AlertCircle } from 'lucide-react';
import { userAPI, invitationAPI } from '../services/api.js';

export default function InviteModal({ session, user, onClose, onInvited }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');
  const [inviting, setInviting] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [invitedUsers, setInvitedUsers] = useState(new Set());

  // Search users when query changes
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      setError('');

      try {
        const response = await userAPI.search(searchQuery.trim());
        // Filter out current user and already invited users
        const filtered = (response.data || []).filter(
          u => u.user_code !== user.user_code && !invitedUsers.has(u.user_code)
        );
        setSearchResults(filtered);
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, user.user_code, invitedUsers]);

  const handleInvite = async (targetUser) => {
    setInviting(targetUser.user_code);
    setError('');
    setSuccess('');

    try {
      const response = await invitationAPI.send(
        session.session_code,
        user.user_code,
        targetUser.user_code,
        message.trim()
      );

      if (response.success) {
        setSuccess(`Invitation sent to ${targetUser.user_name}!`);
        setInvitedUsers(prev => new Set([...prev, targetUser.user_code]));
        setSearchResults(prev => prev.filter(u => u.user_code !== targetUser.user_code));
        onInvited?.(response.data);
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setInviting(null);
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
              Invite to Session
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {session.session_name || session.session_code}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ 
              background: 'var(--color-surface-dark)',
              color: 'var(--color-text-secondary)' 
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div 
            className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
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

        {success && (
          <div 
            className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
            style={{
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: 'var(--color-success-text)',
            }}
          >
            <Check size={16} />
            {success}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search 
            size={16} 
            className="absolute left-4 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-tertiary)' }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or user code..."
            className="w-full rounded-lg pl-10 pr-4 py-3 text-sm outline-none"
            style={{
              background: 'var(--color-surface-dark)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          />
          {searching && (
            <Loader2 
              size={16} 
              className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin"
              style={{ color: 'var(--color-text-tertiary)' }}
            />
          )}
        </div>

        {/* Optional message */}
        <div className="mb-4">
          <label 
            className="block text-sm font-medium mb-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Invitation Message <span style={{ color: 'var(--color-text-tertiary)' }}>(optional)</span>
          </label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g., Please join our research session!"
            className="w-full rounded-lg px-4 py-3 text-sm outline-none"
            style={{
              background: 'var(--color-surface-dark)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        {/* Search Results */}
        <div 
          className="max-h-64 overflow-y-auto rounded-lg"
          style={{ 
            background: 'var(--color-surface-dark)',
            border: '1px solid var(--color-border)',
          }}
        >
          {searchQuery.length < 2 ? (
            <div className="p-4 text-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              Type at least 2 characters to search users
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-4 text-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              {searching ? 'Searching...' : 'No users found'}
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {searchResults.map((targetUser) => (
                <div 
                  key={targetUser.user_code}
                  className="flex items-center justify-between p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div 
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {targetUser.user_name}
                    </div>
                    <div 
                      className="text-xs truncate"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {targetUser.user_email}
                    </div>
                    <code 
                      className="text-xs px-1.5 py-0.5 rounded mt-1 inline-block"
                      style={{ 
                        background: 'var(--color-surface)',
                        color: 'var(--color-text-tertiary)' 
                      }}
                    >
                      {targetUser.user_code}
                    </code>
                  </div>
                  <button
                    onClick={() => handleInvite(targetUser)}
                    disabled={inviting === targetUser.user_code}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ml-3"
                    style={{
                      background: 'var(--color-primary)',
                      border: '1px solid var(--color-primary-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {inviting === targetUser.user_code ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <>
                        <UserPlus size={14} />
                        Invite
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Close button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-sm font-medium"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

