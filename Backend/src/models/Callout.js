const mongoose = require('mongoose');

/**
 * Callout Schema
 * A callout is a collaborative feature that allows session members to 
 * "call out" attention to a specific page/location they are viewing.
 * Other members can see where the callout originated and navigate there.
 */
const CalloutSchema = new mongoose.Schema({
  // Session this callout belongs to
  session_code: {
    type: String,
    required: [true, 'Session code is required'],
    index: true
  },
  
  // User who created the callout
  user_code: {
    type: String,
    required: [true, 'User code is required'],
    uppercase: true,
    index: true
  },
  
  user_name: {
    type: String,
    required: [true, 'User name is required']
  },
  
  // Page/URL information
  page_url: {
    type: String,
    required: [true, 'Page URL is required']
  },
  
  page_title: {
    type: String,
    default: ''
  },
  
  page_domain: {
    type: String,
    default: ''
  },
  
  page_favicon: {
    type: String,
    default: ''
  },
  
  // Scroll position when callout was created
  scroll_position: {
    x: {
      type: Number,
      default: 0
    },
    y: {
      type: Number,
      default: 0
    },
    // Percentage from top (useful for responsive pages)
    y_percentage: {
      type: Number,
      default: 0
    }
  },
  
  // Optional: Selected text at the time of callout
  selected_text: {
    type: String,
    default: null
  },
  
  // Optional: Message/note from the caller
  message: {
    type: String,
    default: '',
    maxLength: 500
  },
  
  // Tab information (for context)
  tab_context: {
    tab_id: Number,
    window_id: Number
  },
  
  // Callout status
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'expired', 'dismissed'],
    default: 'active'
  },
  
  // Users who have acknowledged/seen the callout
  acknowledged_by: [{
    user_code: String,
    user_name: String,
    acknowledged_at: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Expiration (callouts auto-expire after certain time)
  expires_at: {
    type: Date,
    default: function() {
      // Default expiration: 30 minutes from creation
      return new Date(Date.now() + 30 * 60 * 1000);
    }
  },
  
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
CalloutSchema.index({ session_code: 1, status: 1 });
CalloutSchema.index({ session_code: 1, created_at: -1 });
CalloutSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-cleanup

// Virtual to check if callout is expired
CalloutSchema.virtual('is_expired').get(function() {
  return this.expires_at && new Date() > this.expires_at;
});

// Static method to get active callouts for a session
CalloutSchema.statics.getActiveCallouts = async function(sessionCode, excludeUserCode = null) {
  const query = {
    session_code: sessionCode,
    status: 'active',
    expires_at: { $gt: new Date() }
  };
  
  if (excludeUserCode) {
    query.user_code = { $ne: excludeUserCode.toUpperCase() };
  }
  
  return this.find(query).sort({ created_at: -1 });
};

// Static method to get all callouts for a session (including history)
CalloutSchema.statics.getSessionCallouts = async function(sessionCode, limit = 50) {
  return this.find({ session_code: sessionCode })
    .sort({ created_at: -1 })
    .limit(limit);
};

// Method to acknowledge callout
CalloutSchema.methods.acknowledge = async function(userCode, userName) {
  // Don't let the creator acknowledge their own callout
  if (this.user_code === userCode.toUpperCase()) {
    return this;
  }
  
  // Check if already acknowledged
  const alreadyAcked = this.acknowledged_by.some(
    ack => ack.user_code === userCode.toUpperCase()
  );
  
  if (!alreadyAcked) {
    this.acknowledged_by.push({
      user_code: userCode.toUpperCase(),
      user_name: userName,
      acknowledged_at: new Date()
    });
    
    // If all session members have acknowledged, mark as acknowledged
    // (This logic would need session member count, keeping it simple for now)
    await this.save();
  }
  
  return this;
};

// Method to dismiss callout
CalloutSchema.methods.dismiss = async function() {
  this.status = 'dismissed';
  return this.save();
};

module.exports = mongoose.model('Callout', CalloutSchema);

