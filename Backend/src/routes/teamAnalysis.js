const express = require('express');
const router = express.Router();
const { analyzeTeamSession, getAllSessionPages } = require('../services/teamAnalysisService');
const TeamSessionAnalysis = require('../models/TeamSessionAnalysis');

/**
 * @route   POST /api/team-analysis/:session_code/analyze
 * @desc    Manually trigger team session analysis
 * @access  Public
 */
router.post('/:session_code/analyze', async (req, res) => {
  try {
    const { session_code } = req.params;
    const analysis = await analyzeTeamSession(session_code);
    
    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: 'No pages found for analysis'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        session_code: analysis.session_code,
        team_summary: analysis.team_summary,
        team_understanding: analysis.team_understanding,
        total_sites: analysis.total_sites,
        analyzed_sites: analysis.analyzed_sites,
        last_analyzed_at: analysis.last_analyzed_at,
        analysis_count: analysis.analysis_count
      }
    });
  } catch (error) {
    console.error('Error in team analysis endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze team session',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/team-analysis/:session_code
 * @desc    Get team session analysis
 * @access  Public
 */
router.get('/:session_code', async (req, res) => {
  try {
    const { session_code } = req.params;
    const analysis = await TeamSessionAnalysis.findOne({ session_code })
      .populate('session', 'session_name session_description')
      .lean();

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: 'Analysis not found for this session'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        session_code: analysis.session_code,
        team_summary: analysis.team_summary,
        team_understanding: analysis.team_understanding,
        sites: analysis.sites,
        total_sites: analysis.total_sites,
        analyzed_sites: analysis.analyzed_sites,
        last_analyzed_at: analysis.last_analyzed_at,
        analysis_count: analysis.analysis_count
      }
    });
  } catch (error) {
    console.error('Error fetching team analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analysis',
      error: error.message
    });
  }
});

module.exports = router;

