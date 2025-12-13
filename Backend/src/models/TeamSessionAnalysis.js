const mongoose = require('mongoose');

const SiteRelevanceSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: ''
  },
  domain: {
    type: String,
    default: ''
  },
  relevance_score: {
    type: Number,
    min: 0,
    max: 100,
    default: null
  },
  relevance_explanation: {
    type: String,
    default: ''
  },
  analyzed_at: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const TeamSessionAnalysisSchema = new mongoose.Schema({
  session_code: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true
  },
  team_summary: {
    type: String,
    default: ''
  },
  team_understanding: {
    type: String,
    default: ''
  },
  sites: {
    type: [SiteRelevanceSchema],
    default: []
  },
  total_sites: {
    type: Number,
    default: 0
  },
  analyzed_sites: {
    type: Number,
    default: 0
  },
  last_analyzed_at: {
    type: Date,
    default: Date.now
  },
  analysis_count: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient querying
TeamSessionAnalysisSchema.index({ session_code: 1 });
TeamSessionAnalysisSchema.index({ session: 1 });
TeamSessionAnalysisSchema.index({ 'sites.url': 1 });

// Method to get sites without relevance scores
TeamSessionAnalysisSchema.methods.getUnanalyzedSites = function() {
  return this.sites.filter(site => site.relevance_score === null || site.relevance_score === undefined);
};

// Method to update or add site relevance
TeamSessionAnalysisSchema.methods.updateSiteRelevance = function(url, relevanceData) {
  const siteIndex = this.sites.findIndex(s => s.url === url);
  if (siteIndex >= 0) {
    // Update existing site - preserve all existing fields, only update relevance data
    const existingSite = this.sites[siteIndex];
    this.sites[siteIndex] = {
      url: existingSite.url, // Preserve original URL (required)
      title: existingSite.title || '', // Preserve title
      domain: existingSite.domain || '', // Preserve domain
      relevance_score: relevanceData.relevance_score !== undefined ? relevanceData.relevance_score : existingSite.relevance_score,
      relevance_explanation: relevanceData.relevance_explanation !== undefined ? relevanceData.relevance_explanation : existingSite.relevance_explanation,
      analyzed_at: new Date()
    };
  } else {
    // Add new site (shouldn't happen in normal flow, but handle it)
    this.sites.push({
      url: url, // Required field
      title: relevanceData.title || '',
      domain: relevanceData.domain || '',
      relevance_score: relevanceData.relevance_score || null,
      relevance_explanation: relevanceData.relevance_explanation || '',
      analyzed_at: new Date()
    });
  }
  this.analyzed_sites = this.sites.filter(s => s.relevance_score !== null && s.relevance_score !== undefined).length;
  this.total_sites = this.sites.length;
};

module.exports = mongoose.model('TeamSessionAnalysis', TeamSessionAnalysisSchema);

