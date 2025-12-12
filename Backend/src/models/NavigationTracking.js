const mongoose = require('mongoose');

// Schema for individual navigation events
const NavigationEventSchema = new mongoose.Schema({
  event_type: {
    type: String,
    required: true,
    enum: [
      'EXTENSION_LOADED',
      'RECORDING_STARTED',
      'RECORDING_STOPPED',
      'EXISTING_TABS_SNAPSHOT',
      'WINDOW_CREATED',
      'WINDOW_CLOSED',
      'WINDOW_FOCUSED',
      'WINDOW_UNFOCUSED',
      'BROWSER_FOCUSED',
      'BROWSER_UNFOCUSED',
      'TAB_OPEN',
      'TAB_CLOSE',
      'TAB_ACTIVATED',
      'TAB_UPDATED',
      'PAGE_OPEN',
      'PAGE_URL_CHANGE',
      'PAGE_RELOAD',
      'PAGE_VISIBLE',
      'PAGE_HIDDEN',
      'BACK_NAVIGATION',
      'FORWARD_NAVIGATION',
      'SEARCH'
    ]
  },
  timestamp: {
    type: Date,
    required: true
  },
  context: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { _id: false });

// Main schema for tracking sessions
const NavigationTrackingSchema = new mongoose.Schema({
  user_code: {
    type: Number,
    required: true,
    index: true
  },
  session_code: {
    type: String,
    required: true,
    index: true
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    default: null
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  recording_started_at: {
    type: Date,
    required: true
  },
  recording_ended_at: {
    type: Date,
    default: null
  },
  navigation_events: [NavigationEventSchema],
  is_active: {
    type: Boolean,
    default: true
  },
  event_count: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true  // Adds createdAt and updatedAt
});

// Compound index for efficient querying
NavigationTrackingSchema.index({ user_code: 1, session_code: 1 });
NavigationTrackingSchema.index({ recording_started_at: -1 });
NavigationTrackingSchema.index({ is_active: 1 });

// Virtual for getting event count
NavigationTrackingSchema.virtual('total_events').get(function() {
  return this.navigation_events.length;
});

// Method to add a single event
NavigationTrackingSchema.methods.addEvent = function(eventType, context) {
  this.navigation_events.push({
    event_type: eventType,
    timestamp: new Date(),
    context: context || {}
  });
  this.event_count = this.navigation_events.length;
  return this.save();
};

// Method to end recording
NavigationTrackingSchema.methods.endRecording = function() {
  this.recording_ended_at = new Date();
  this.is_active = false;
  return this.save();
};

// Static method to find or create session
NavigationTrackingSchema.statics.findOrCreateSession = async function(userCode, sessionCode, userId = null, sessionId = null) {
  let tracking = await this.findOne({
    user_code: userCode,
    session_code: sessionCode,
    is_active: true
  });

  if (!tracking) {
    tracking = await this.create({
      user_code: userCode,
      session_code: sessionCode,
      user: userId,
      session: sessionId,
      recording_started_at: new Date(),
      navigation_events: [],
      is_active: true
    });
  }

  return tracking;
};

// Static method to get all tracking data for a session (all users combined)
NavigationTrackingSchema.statics.getSessionTrackingData = async function(sessionCode) {
  const trackingRecords = await this.find({ session_code: sessionCode })
    .populate('user')
    .sort({ recording_started_at: 1 });
  
  return trackingRecords;
};

// Static method to get combined events for all users in a session
NavigationTrackingSchema.statics.getCombinedSessionEvents = async function(sessionCode) {
  const trackingRecords = await this.find({ session_code: sessionCode })
    .populate('user')
    .sort({ recording_started_at: 1 });
  
  // Combine all events with user attribution
  const allEvents = [];
  
  trackingRecords.forEach(record => {
    record.navigation_events.forEach(event => {
      allEvents.push({
        event_type: event.event_type,
        timestamp: event.timestamp,
        context: event.context,
        user_code: record.user_code,
        user_name: record.user ? record.user.user_name : `User ${record.user_code}`
      });
    });
  });
  
  // Sort by timestamp
  allEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  return {
    session_code: sessionCode,
    total_participants: trackingRecords.length,
    total_events: allEvents.length,
    participants: trackingRecords.map(r => ({
      user_code: r.user_code,
      user_name: r.user ? r.user.user_name : `User ${r.user_code}`,
      event_count: r.navigation_events.length,
      recording_started_at: r.recording_started_at,
      recording_ended_at: r.recording_ended_at,
      is_active: r.is_active
    })),
    combined_events: allEvents
  };
};

module.exports = mongoose.model('NavigationTracking', NavigationTrackingSchema);

