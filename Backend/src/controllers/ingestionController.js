const { batchIngest } = require('../services/ingestionService');
const IngestedContent = require('../models/IngestedContent');

/**
 * Ingest selected sources (pages and websites)
 */
const ingestSources = async (req, res) => {
  try {
    const { sources, session_code } = req.body;
    const userCode = req.user?.user_code || req.body.user_code;
    
    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No sources provided for ingestion'
      });
    }
    
    if (!userCode) {
      return res.status(400).json({
        success: false,
        message: 'User code is required'
      });
    }
    
    if (!session_code) {
      return res.status(400).json({
        success: false,
        message: 'Session code is required for ingestion'
      });
    }
    
    // Process batch ingestion
    const results = await batchIngest(sources, userCode, session_code);
    
    // Calculate totals
    const totalSuccess = results.pages.success.length + results.websites.success.length;
    const totalFailed = results.pages.failed.length + results.websites.failed.length;
    
    res.json({
      success: true,
      message: `Ingested ${totalSuccess} source(s) successfully${totalFailed > 0 ? `, ${totalFailed} failed` : ''}`,
      results: {
        pages: {
          success: results.pages.success.length,
          failed: results.pages.failed.length,
          details: results.pages
        },
        websites: {
          success: results.websites.success.length,
          failed: results.websites.failed.length,
          details: results.websites
        }
      }
    });
  } catch (error) {
    console.error('Error in ingestSources:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to ingest sources',
      error: error.message
    });
  }
};

/**
 * Get ingested content
 */
const getIngestedContent = async (req, res) => {
  try {
    const { source_type, page_id, url, session_code } = req.query;
    
    const query = {};
    
    if (source_type) {
      query.source_type = source_type;
    }
    
    if (page_id) {
      query.page_id = page_id;
    }
    
    if (url) {
      query.url = url;
    }
    
    if (session_code) {
      query.session_code = session_code;
    }
    
    const ingested = await IngestedContent.find(query)
      .sort({ scraped_at: -1 })
      .limit(100);
    
    res.json({
      success: true,
      data: ingested,
      count: ingested.length
    });
  } catch (error) {
    console.error('Error getting ingested content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ingested content',
      error: error.message
    });
  }
};

/**
 * Check if sources are already ingested
 */
const checkIngested = async (req, res) => {
  try {
    const { sources, session_code } = req.body;
    
    if (!sources || !Array.isArray(sources)) {
      return res.status(400).json({
        success: false,
        message: 'Sources array is required'
      });
    }
    
    if (!session_code) {
      return res.status(400).json({
        success: false,
        message: 'Session code is required'
      });
    }
    
    const ingestedMap = {};
    const statusMap = {}; // Track status: 'completed', 'failed', or null
    
    for (const source of sources) {
      let query = {
        session_code: session_code
      };
      
      if (source.type === 'page') {
        query.source_type = 'page';
        query.page_id = source.pageId;
        query.page_model = source.isTeam ? 'TeamPage' : 'PrivatePage';
      } else if (source.type === 'website') {
        query.source_type = 'website';
        query.url = source.url;
      }
      
      const ingested = await IngestedContent.findOne(query);
      
      const key = source.type === 'page' 
        ? `${source.isTeam ? 'team' : 'personal'}_${source.pageId}`
        : source.url;
      
      ingestedMap[key] = !!ingested;
      
      // Track status if ingested
      if (ingested) {
        statusMap[key] = {
          status: ingested.status || 'completed',
          error_message: ingested.error_message || null
        };
      } else {
        statusMap[key] = null;
      }
    }
    
    res.json({
      success: true,
      ingested: ingestedMap,
      status: statusMap // Include status information
    });
  } catch (error) {
    console.error('Error checking ingested status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check ingested status',
      error: error.message
    });
  }
};

module.exports = {
  ingestSources,
  getIngestedContent,
  checkIngested
};

