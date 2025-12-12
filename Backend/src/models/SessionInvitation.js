const mongoose = require('mongoose');

const SessionInvitationSchema = new mongoose.Schema({
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true
  },
  session_code: {
    type: String,
    required: true,
    index: true
  },
  invited_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  invited_user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  invited_user_code: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'cancelled'],
    default: 'pending',
    index: true
  },
  message: {
    type: String,
    trim: true,
    default: ''
  },
  responded_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate pending invitations
SessionInvitationSchema.index(
  { session: 1, invited_user: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

// Index for efficient queries
SessionInvitationSchema.index({ invited_user_code: 1, status: 1 });
SessionInvitationSchema.index({ session_code: 1, status: 1 });

/**
 * Check if user already has a pending invitation for this session
 */
SessionInvitationSchema.statics.hasPendingInvitation = async function(sessionId, userId) {
  const existing = await this.findOne({
    session: sessionId,
    invited_user: userId,
    status: 'pending'
  });
  return !!existing;
};

/**
 * Get all pending invitations for a user
 */
SessionInvitationSchema.statics.getPendingInvitations = function(userCode) {
  return this.find({
    invited_user_code: userCode.toUpperCase(),
    status: 'pending'
  })
    .populate('session', 'session_code session_name session_description is_active')
    .populate('invited_by', 'user_name user_code user_email')
    .sort({ createdAt: -1 });
};

/**
 * Get invitation by ID with populated fields
 */
SessionInvitationSchema.statics.getInvitationById = function(invitationId) {
  return this.findById(invitationId)
    .populate('session', 'session_code session_name session_description is_active created_by')
    .populate('invited_by', 'user_name user_code user_email')
    .populate('invited_user', 'user_name user_code user_email');
};

module.exports = mongoose.model('SessionInvitation', SessionInvitationSchema);

