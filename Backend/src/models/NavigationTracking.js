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
      'WINDOW_CREATED',
      'WINDOW_CLOSED',
      'WINDOW_FOCUSED',
      'WINDOW_UNFOCUSED',
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
NavigationTrackingSchema.statics.findOrCreateSession = async function(userCode, sessionCode) {
  let session = await this.findOne({
    user_code: userCode,
    session_code: sessionCode,
    is_active: true
  });

  if (!session) {
    session = await this.create({
      user_code: userCode,
      session_code: sessionCode,
      recording_started_at: new Date(),
      navigation_events: [],
      is_active: true
    });
  }

  return session;
};

module.exports = mongoose.model('NavigationTracking', NavigationTrackingSchema);

