const mongoose = require('mongoose');

// Subdocument schema for sources
const SourceSchema = new mongoose.Schema({
  source_number: {
    type: Number,
    default: 0
  },
  type: {
    type: String,
    default: 'website'
  },
  title: {
    type: String,
    default: ''
  },
  url: {
    type: String,
    default: null
  },
  relevance: {
    type: String,
    default: ''
  }
}, { _id: false });

const ChatHistorySchema = new mongoose.Schema({
  // Session reference
  session_code: {
    type: String,
    required: true,
    index: true
  },
  
  // User who sent the message
  user_code: {
    type: String,
    required: true,
    index: true
  },
  
  // Message content
  prompt: {
    type: String,
    required: true
  },
  
  // AI response
  response: {
    answer: {
      type: String,
      required: true
    },
    sources: {
      type: [SourceSchema],
      default: []
    }
  },
  
  // Selected sources for this query
  source_ids: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'IngestedContent'
  }],
  
  // Timestamp
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes
ChatHistorySchema.index({ session_code: 1, created_at: -1 });
ChatHistorySchema.index({ user_code: 1, created_at: -1 });

module.exports = mongoose.model('ChatHistory', ChatHistorySchema);

