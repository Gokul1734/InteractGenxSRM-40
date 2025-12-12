const mongoose = require('mongoose');

// Schema for session members (embedded user info with join time and navigation tracking)
const SessionMemberSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  user_code: {
    type: String,
    required: true,
    uppercase: true
  },
  user_name: {
    type: String,
    required: true
  },
  navigation_tracking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NavigationTracking',
    default: null
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
  session_description: {
    type: String,
    required: [true, 'Session description is required'],
    trim: true
  },
  members: [SessionMemberSchema],
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Session must have a creator. Only existing users can create sessions.']
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

// Pre-save hook to ensure creator is always in members list
SessionSchema.pre('save', async function(next) {
  // Only proceed if created_by exists
  if (!this.created_by) {
    return next();
  }

  // Check if creator is already in members by comparing user ObjectIds
  const creatorInMembers = this.members.some(
    member => member.user && member.user.toString() === this.created_by.toString()
  );

  // If creator is not in members, we need to fetch user details and add them
  if (!creatorInMembers) {
    try {
      // Fetch the creator user to get their details
      const User = mongoose.model('User');
      const creatorUser = await User.findById(this.created_by);
      
      if (creatorUser) {
        // Add creator to members list
        this.members.push({
          user: creatorUser._id,
          user_code: creatorUser.user_code,
          user_name: creatorUser.user_name,
          is_active: true,
          joined_at: this.started_at || this.createdAt || new Date()
        });
      }
    } catch (error) {
      // If user fetch fails, log but don't block save
      console.warn('Warning: Could not fetch creator user in pre-save hook:', error.message);
    }
  }

  next();
});

// Virtual for member count
SessionSchema.virtual('member_count').get(function() {
  return this.members.filter(m => m.is_active).length;
});

// Method to add a member to session - uses atomic operations for concurrency safety
SessionSchema.methods.addMember = async function(user, navigationTrackingId = null) {
  const Session = mongoose.model('Session');
  
  // Check if user is already a member
  const existingMember = this.members.find(m => m.user_code === user.user_code);
  
  if (existingMember) {
    // Reactivate existing member using atomic $set operation
    const updateFields = {
      'members.$.is_active': true,
      'members.$.left_at': null
    };
    if (navigationTrackingId) {
      updateFields['members.$.navigation_tracking'] = navigationTrackingId;
    }
    
    const updated = await Session.findOneAndUpdate(
      { _id: this._id, 'members.user_code': user.user_code },
      { $set: updateFields },
      { new: true }
    );
    
    // Update local state to reflect changes
    if (updated) {
      const memberIndex = this.members.findIndex(m => m.user_code === user.user_code);
      if (memberIndex !== -1) {
        this.members[memberIndex].is_active = true;
        this.members[memberIndex].left_at = null;
        if (navigationTrackingId) {
          this.members[memberIndex].navigation_tracking = navigationTrackingId;
        }
      }
    }
    return updated || this;
  } else {
    // Add new member using atomic $push operation
    const newMember = {
      user: user._id,
      user_code: user.user_code,
      user_name: user.user_name,
      navigation_tracking: navigationTrackingId,
      joined_at: new Date(),
      is_active: true
    };
    
    const updated = await Session.findOneAndUpdate(
      { _id: this._id },
      { $push: { members: newMember } },
      { new: true }
    );
    
    // Update local state to reflect changes
    if (updated) {
      this.members.push(newMember);
    }
    return updated || this;
  }
};

// Method to update member's navigation tracking reference - uses atomic operations for concurrency safety
SessionSchema.methods.updateMemberTracking = async function(userCode, navigationTrackingId) {
  const Session = mongoose.model('Session');
  
  // Use atomic $set operation to update only the specific member's tracking reference
  const updated = await Session.findOneAndUpdate(
    { _id: this._id, 'members.user_code': userCode.toUpperCase() },
    { $set: { 'members.$.navigation_tracking': navigationTrackingId } },
    { new: true }
  );
  
  // Update local state to reflect changes
  if (updated) {
    const member = this.members.find(m => m.user_code === userCode.toUpperCase());
    if (member) {
      member.navigation_tracking = navigationTrackingId;
    }
  }
  
  return updated;
};

// Method to remove a member from session - uses atomic operations for concurrency safety
SessionSchema.methods.removeMember = async function(userCode) {
  const Session = mongoose.model('Session');
  
  // Use atomic $set operation to mark member as inactive
  const updated = await Session.findOneAndUpdate(
    { _id: this._id, 'members.user_code': userCode.toUpperCase() },
    { 
      $set: { 
        'members.$.is_active': false,
        'members.$.left_at': new Date()
      } 
    },
    { new: true }
  );
  
  // Update local state to reflect changes
  if (updated) {
    const member = this.members.find(m => m.user_code === userCode.toUpperCase());
    if (member) {
      member.is_active = false;
      member.left_at = new Date();
    }
  }
  
  return updated || this;
};

// Method to end session - uses atomic operations for concurrency safety
SessionSchema.methods.endSession = async function() {
  const Session = mongoose.model('Session');
  const now = new Date();
  
  // Use atomic operation to end session and mark all members as left
  const updated = await Session.findOneAndUpdate(
    { _id: this._id },
    { 
      $set: { 
        is_active: false,
        ended_at: now,
        'members.$[activeMember].is_active': false,
        'members.$[activeMember].left_at': now
      } 
    },
    { 
      new: true,
      arrayFilters: [{ 'activeMember.is_active': true }]
    }
  );
  
  // Update local state to reflect changes
  if (updated) {
    this.is_active = false;
    this.ended_at = now;
    this.members.forEach(member => {
      if (member.is_active) {
        member.is_active = false;
        member.left_at = now;
      }
    });
  }
  
  return updated || this;
};

/**
 * Generate a unique session code with format: XXXXXXS (6 random digits + S suffix)
 */
SessionSchema.statics.generateSessionCode = async function() {
  let sessionCode;
  let isUnique = false;
  
  while (!isUnique) {
    // Generate 6 random digits
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    sessionCode = `${randomDigits}S`;
    
    // Check if code already exists
    const existing = await this.findOne({ session_code: sessionCode });
    if (!existing) {
      isUnique = true;
    }
  }
  
  return sessionCode;
};

// Static method to find or create session (requires creator user for new sessions)
SessionSchema.statics.findOrCreateSession = async function(sessionCode, sessionName, sessionDescription, creatorUser) {
  // Generate session code if not provided
  const code = sessionCode || await this.generateSessionCode();
  let session = await this.findOne({ session_code: code });
  
  if (!session) {
    // Creator user is required for new sessions
    if (!creatorUser || !creatorUser._id) {
      throw new Error('Creator user is required to create a new session');
    }
    
    // Auto-add creator as first member
    session = await this.create({
      session_code: code,
      session_name: sessionName || `Session ${code}`,
      session_description: sessionDescription || `Tracking session ${code}`,
      created_by: creatorUser._id,
      members: [{
        user: creatorUser._id,
        user_code: creatorUser.user_code,
        user_name: creatorUser.user_name,
        is_active: true,
        joined_at: new Date()
      }],
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

// Static method to get session with populated members and their navigation tracking
SessionSchema.statics.getSessionWithMembers = function(sessionCode) {
  return this.findOne({ session_code: sessionCode })
    .populate('members.user')
    .populate('members.navigation_tracking')
    .populate('created_by');
};

module.exports = mongoose.model('Session', SessionSchema);

