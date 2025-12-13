const mongoose = require('mongoose');

const MemberSummarySchema = new mongoose.Schema({
  session_code: {
    type: String,
    required: true,
    index: true
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true
  },
  user_code: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  summary: {
    type: String,
    required: true
  },
  relevance_score: {
    type: Number,
    min: 0,
    max: 100,
    default: null
  },
  event_count: {
    type: Number,
    default: 0
  },
  generated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for efficient querying
MemberSummarySchema.index({ session_code: 1, user_code: 1 });
MemberSummarySchema.index({ session: 1, user: 1 });

// Static method to find or create summary
MemberSummarySchema.statics.findOrCreate = async function(sessionCode, userCode, sessionId, userId) {
  const normalizedUserCode = String(userCode).toUpperCase();
  const normalizedSessionCode = String(sessionCode);
  
  let summary = await this.findOne({
    session_code: normalizedSessionCode,
    user_code: normalizedUserCode
  });
  
  if (!summary) {
    summary = await this.create({
      session_code: normalizedSessionCode,
      session: sessionId,
      user_code: normalizedUserCode,
      user: userId,
      summary: '',
      relevance_score: null,
      event_count: 0
    });
  }
  
  return summary;
};

module.exports = mongoose.model('MemberSummary', MemberSummarySchema);

