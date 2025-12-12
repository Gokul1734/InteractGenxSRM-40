// API Service - All backend API calls
import config from '../config.js';

const BASE_URL = config.API_BASE_URL;

// Helper for making API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`[API] Error calling ${endpoint}:`, error);
    throw error;
  }
}

// ==================== USER APIs ====================

export const userAPI = {
  // Create a new user (signup)
  create: async (name, email) => {
    return apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify({
        user_name: name,
        user_email: email,
      }),
    });
  },

  // Get user by email (for login)
  getByEmail: async (email) => {
    const response = await apiRequest('/users');
    const users = response.data || [];
    const user = users.find(u => u.user_email.toLowerCase() === email.toLowerCase());
    if (!user) {
      throw new Error('User not found. Please sign up first.');
    }
    return { success: true, data: user };
  },

  // Get user by user_code
  getByCode: async (userCode) => {
    return apiRequest(`/users/${userCode}`);
  },

  // Validate user code
  validate: async (userCode) => {
    return apiRequest(`/users/validate/${userCode}`);
  },

  // Get all users
  getAll: async (activeOnly = false) => {
    const query = activeOnly ? '?active_only=true' : '';
    return apiRequest(`/users${query}`);
  },

  // Get user's sessions
  getSessions: async (userCode) => {
    return apiRequest(`/users/${userCode}/sessions`);
  },

  // Update user
  update: async (userCode, updates) => {
    return apiRequest(`/users/${userCode}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // Search users by name or email (for inviting)
  search: async (query) => {
    const response = await apiRequest('/users?active_only=true');
    const users = response.data || [];
    const q = query.toLowerCase();
    return {
      success: true,
      data: users.filter(u => 
        u.user_name.toLowerCase().includes(q) || 
        u.user_email.toLowerCase().includes(q) ||
        u.user_code.toLowerCase().includes(q)
      )
    };
  },
};

// ==================== SESSION APIs ====================

export const sessionAPI = {
  // Create a new session
  create: async (name, description, creatorUserCode) => {
    return apiRequest('/sessions', {
      method: 'POST',
      body: JSON.stringify({
        session_name: name,
        session_description: description,
        created_by_user_code: creatorUserCode,
      }),
    });
  },

  // Get all sessions
  getAll: async (activeOnly = false) => {
    const query = activeOnly ? '?active_only=true' : '';
    return apiRequest(`/sessions${query}`);
  },

  // Get session by code
  getByCode: async (sessionCode) => {
    return apiRequest(`/sessions/${sessionCode}`);
  },

  // Get full session data with navigation tracking
  getFull: async (sessionCode) => {
    return apiRequest(`/sessions/${sessionCode}/full`);
  },

  // Get live updates for session
  getLiveUpdate: async (sessionCode, since = null) => {
    const query = since ? `?since=${encodeURIComponent(since)}` : '';
    return apiRequest(`/sessions/${sessionCode}/getLiveUpdate${query}`);
  },

  // Update session
  update: async (sessionCode, updates) => {
    return apiRequest(`/sessions/${sessionCode}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // End session
  end: async (sessionCode) => {
    return apiRequest(`/sessions/${sessionCode}/end`, {
      method: 'POST',
    });
  },

  // Delete session
  delete: async (sessionCode) => {
    return apiRequest(`/sessions/${sessionCode}`, {
      method: 'DELETE',
    });
  },

  // Validate session code
  validate: async (sessionCode) => {
    return apiRequest(`/sessions/validate/${sessionCode}`);
  },

  // Get session members
  getMembers: async (sessionCode, activeOnly = false) => {
    const query = activeOnly ? '?active_only=true' : '';
    return apiRequest(`/sessions/${sessionCode}/members${query}`);
  },

  // Add member to session
  addMember: async (sessionCode, userCode) => {
    return apiRequest(`/sessions/${sessionCode}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_code: userCode }),
    });
  },

  // Remove member from session
  removeMember: async (sessionCode, userCode) => {
    return apiRequest(`/sessions/${sessionCode}/members/${userCode}`, {
      method: 'DELETE',
    });
  },
};

// ==================== INVITATION APIs ====================

export const invitationAPI = {
  // Send invitation
  send: async (sessionCode, inviterUserCode, inviteeUserCode, message = '') => {
    return apiRequest(`/sessions/${sessionCode}/invitations`, {
      method: 'POST',
      body: JSON.stringify({
        inviter_user_code: inviterUserCode,
        invitee_user_code: inviteeUserCode,
        message,
      }),
    });
  },

  // Get invitations for a session
  getForSession: async (sessionCode, status = null) => {
    const query = status ? `?status=${status}` : '';
    return apiRequest(`/sessions/${sessionCode}/invitations${query}`);
  },

  // Get pending invitations for a user
  getPending: async (userCode) => {
    return apiRequest(`/invitations/pending/${userCode}`);
  },

  // Accept invitation
  accept: async (invitationId, userCode) => {
    return apiRequest(`/invitations/${invitationId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ user_code: userCode }),
    });
  },

  // Decline invitation
  decline: async (invitationId, userCode) => {
    return apiRequest(`/invitations/${invitationId}/decline`, {
      method: 'POST',
      body: JSON.stringify({ user_code: userCode }),
    });
  },

  // Cancel invitation (by session creator)
  cancel: async (invitationId, userCode) => {
    return apiRequest(`/invitations/${invitationId}`, {
      method: 'DELETE',
      body: JSON.stringify({ user_code: userCode }),
    });
  },
};

// ==================== TRACKING APIs ====================

export const trackingAPI = {
  // Start tracking
  start: async (userCode, sessionCode, userName, userEmail, sessionName, sessionDescription) => {
    return apiRequest('/tracking-files/start', {
      method: 'POST',
      body: JSON.stringify({
        user_code: userCode,
        session_code: sessionCode,
        user_name: userName,
        user_email: userEmail,
        session_name: sessionName,
        session_description: sessionDescription,
      }),
    });
  },

  // Update tracking data
  update: async (userCode, sessionCode, data) => {
    return apiRequest('/tracking-files/update', {
      method: 'POST',
      body: JSON.stringify({
        user_code: userCode,
        session_code: sessionCode,
        data,
      }),
    });
  },

  // Stop tracking (user-specific - only stops recording for this user)
  stop: async (userCode, sessionCode, userId = null) => {
    return apiRequest('/tracking-files/stop', {
      method: 'POST',
      body: JSON.stringify({
        user_code: userCode,
        session_code: sessionCode,
        ...(userId && { user_id: userId }), // Include user_id if provided for additional specificity
      }),
    });
  },

  // Get tracking session data
  getSession: async (userCode, sessionCode) => {
    return apiRequest(`/tracking-files/session/${userCode}/${sessionCode}`);
  },

  // Get live collaborative data
  getLive: async (sessionCode) => {
    return apiRequest(`/tracking-files/live/${sessionCode}`);
  },

  // Get session members with live status
  getSessionMembers: async (sessionCode) => {
    return apiRequest(`/tracking-files/sessions/${sessionCode}/members`);
  },

  // Health check
  health: async () => {
    return apiRequest('/tracking-files/health');
  },
};

export default {
  user: userAPI,
  session: sessionAPI,
  invitation: invitationAPI,
  tracking: trackingAPI,
};

