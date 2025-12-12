import React from 'react';
import { Users, Clock, Play, UserPlus, Eye, Trash2 } from 'lucide-react';

export default function SessionCard({ 
  session, 
  isCreator, 
  onInvite, 
  onView, 
  onJoinLive,
  onDelete 
}) {
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const memberCount = session.member_count || session.members?.length || 0;
  const activeMemberCount = session.active_member_count || 0;

  return (
    <div
      className="rounded-xl p-5 transition-all hover:border-opacity-80"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 
              className="text-base font-semibold truncate"
              style={{ color: 'var(--color-text-title)' }}
            >
              {session.session_name || `Session ${session.session_code}`}
            </h3>
            {session.is_active && (
              <span 
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                style={{ 
                  background: 'rgba(34, 197, 94, 0.15)',
                  color: 'var(--color-success-text)',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                Active
              </span>
            )}
          </div>
          <code 
            className="text-xs px-2 py-0.5 rounded mt-1 inline-block"
            style={{ 
              background: 'var(--color-surface-dark)',
              color: 'var(--color-text-secondary)' 
            }}
          >
            {session.session_code}
          </code>
        </div>

        {isCreator && (
          <span 
            className="text-xs px-2 py-1 rounded-lg"
            style={{ 
              background: 'var(--color-primary)',
              color: 'var(--color-text-primary)',
            }}
          >
            Creator
          </span>
        )}
      </div>

      {/* Description */}
      <p 
        className="text-sm line-clamp-2 mb-4"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {session.session_description || 'No description'}
      </p>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4">
        <div 
          className="flex items-center gap-1.5 text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <Users size={14} />
          <span>
            {activeMemberCount}/{memberCount} members
          </span>
        </div>
        <div 
          className="flex items-center gap-1.5 text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <Clock size={14} />
          <span>{formatDate(session.started_at)}</span>
        </div>
      </div>

      {/* Creator info */}
      {session.created_by && (
        <div 
          className="text-xs mb-4 pb-4 border-b"
          style={{ 
            color: 'var(--color-text-tertiary)',
            borderColor: 'var(--color-border)',
          }}
        >
          Created by: <span style={{ color: 'var(--color-text-secondary)' }}>
            {session.created_by.user_name || session.created_by.user_code}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onJoinLive?.(session)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: 'var(--color-primary)',
            border: '1px solid var(--color-primary-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          <Play size={14} />
          Join Live
        </button>

        <button
          onClick={() => onView?.(session)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: 'transparent',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <Eye size={14} />
          Details
        </button>

        {isCreator && (
          <>
            <button
              onClick={() => onInvite?.(session)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <UserPlus size={14} />
              Invite
            </button>

            <button
              onClick={() => onDelete?.(session)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: 'transparent',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                color: 'var(--color-error-text)',
              }}
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

