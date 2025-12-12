const mongoose = require('mongoose');

// Schema for session members (embedded user info with join time)
const SessionMemberSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  user_code: {
    type: Number,
    required: true
  },
  user_name: {
    type: String,
    required: true
  },
  joined_at: {
    type: Date,
    default: Date.now
  },
  left_at: {
    type: Date,
    default: null
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, { _id: false });

// Main Session Schema
const SessionSchema = new mongoose.Schema({
  session_code: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  session_name: {
    type: String,
    required: true,
    trim: true
  },
  members: [SessionMemberSchema],
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  is_active: {
    type: Boolean,
    default: true
  },
  started_at: {
    type: Date,
    default: Date.now
  },
  ended_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
SessionSchema.index({ session_code: 1 });
SessionSchema.index({ 'members.user_code': 1 });
SessionSchema.index({ is_active: 1 });

// Virtual for member count
SessionSchema.virtual('member_count').get(function() {
  return this.members.filter(m => m.is_active).length;
});

// Method to add a member to session
SessionSchema.methods.addMember = async function(user) {
  // Check if user is already a member
  const existingMember = this.members.find(m => m.user_code === user.user_code);
  
  if (existingMember) {
    // Reactivate if previously left
    existingMember.is_active = true;
    existingMember.left_at = null;
  } else {
    this.members.push({
      user: user._id,
      user_code: user.user_code,
      user_name: user.user_name,
      joined_at: new Date(),
      is_active: true
    });
  }
  
  return this.save();
};

// Method to remove a member from session
SessionSchema.methods.removeMember = async function(userCode) {
  const member = this.members.find(m => m.user_code === userCode);
  
  if (member) {
    member.is_active = false;
    member.left_at = new Date();
  }
  
  return this.save();
};

// Method to end session
SessionSchema.methods.endSession = function() {
  this.is_active = false;
  this.ended_at = new Date();
  
  // Mark all members as left
  this.members.forEach(member => {
    if (member.is_active) {
      member.is_active = false;
      member.left_at = new Date();
    }
  });
  
  return this.save();
};

// Static method to find or create session
SessionSchema.statics.findOrCreateSession = async function(sessionCode, sessionName, creatorUser) {
  let session = await this.findOne({ session_code: sessionCode });
  
  if (!session) {
    session = await this.create({
      session_code: sessionCode,
      session_name: sessionName || `Session ${sessionCode}`,
      created_by: creatorUser ? creatorUser._id : null,
      members: [],
      is_active: true
    });
  }
  
  return session;
};

// Static method to get collaborative data for a session
// This aggregates all navigation events from all users in the session
SessionSchema.statics.getCollaborativeData = async function(sessionCode) {
  const NavigationTracking = mongoose.model('NavigationTracking');
  
  // Find the session
  const session = await this.findOne({ session_code: sessionCode }).populate('members.user');
  
  if (!session) {
    return null;
  }
  
  // Get all user codes from session members
  const userCodes = session.members.map(m => m.user_code);
  
  // Fetch all navigation tracking data for these users in this session
  const trackingData = await NavigationTracking.find({
    session_code: sessionCode,
    user_code: { $in: userCodes }
  }).sort({ 'navigation_events.timestamp': 1 });
  
  // Combine all events with user attribution
  const collaborativeEvents = [];
  
  trackingData.forEach(tracking => {
    const member = session.members.find(m => m.user_code === tracking.user_code);
    
    tracking.navigation_events.forEach(event => {
      collaborativeEvents.push({
        ...event.toObject(),
        user_code: tracking.user_code,
        user_name: member ? member.user_name : `User ${tracking.user_code}`
      });
    });
  });
  
  // Sort all events by timestamp
  collaborativeEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  return {
    session_code: session.session_code,
    session_name: session.session_name,
    members: session.members,
    member_count: session.members.filter(m => m.is_active).length,
    is_active: session.is_active,
    started_at: session.started_at,
    ended_at: session.ended_at,
    collaborative_events: collaborativeEvents,
    total_events: collaborativeEvents.length,
    events_by_user: trackingData.map(t => ({
      user_code: t.user_code,
      user_name: session.members.find(m => m.user_code === t.user_code)?.user_name || `User ${t.user_code}`,
      event_count: t.navigation_events.length,
      recording_started_at: t.recording_started_at,
      recording_ended_at: t.recording_ended_at
    }))
  };
};

// Static method to get session with populated members
SessionSchema.statics.getSessionWithMembers = function(sessionCode) {
  return this.findOne({ session_code: sessionCode })
    .populate('members.user')
    .populate('created_by');
};

module.exports = mongoose.model('Session', SessionSchema);

