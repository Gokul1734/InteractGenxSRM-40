const mongoose = require('mongoose');

const IngestedContentSchema = new mongoose.Schema({
  // Source type: 'page' or 'website'
  source_type: {
    type: String,
    required: true,
    enum: ['page', 'website']
  },
  
  // For pages: reference to TeamPage or PrivatePage
  page_id: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'page_model',
    default: null
  },
  page_model: {
    type: String,
    enum: ['TeamPage', 'PrivatePage'],
    default: null
  },
  page_title: {
    type: String,
    default: ''
  },
  
  // For websites: URL and metadata
  url: {
    type: String,
    default: null,
    index: true
  },
  domain: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    default: ''
  },
  
  // Content data
  content: {
    type: String,
    required: false, // Allow empty content (pages might be empty)
    default: '' // Default to empty string
  },
  
  // Metadata
  scraped_at: {
    type: Date,
    default: Date.now
  },
  scraped_by: {
    type: String, // user_code
    default: null
  },
  
  // Session reference (if ingested from AI Studio)
  session_code: {
    type: String,
    default: null,
    index: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  },
  error_message: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
IngestedContentSchema.index({ source_type: 1, url: 1 });
IngestedContentSchema.index({ source_type: 1, page_id: 1 });
IngestedContentSchema.index({ session_code: 1 });

module.exports = mongoose.model('IngestedContent', IngestedContentSchema);

