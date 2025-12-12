const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Base directory for tracking data (within project)
const TRACKING_DATA_DIR = path.join(__dirname, '../../tracking-data');

// Ensure tracking data directory exists
async function ensureTrackingDir() {
  try {
    await fs.access(TRACKING_DATA_DIR);
  } catch {
    await fs.mkdir(TRACKING_DATA_DIR, { recursive: true });
  }
}

// Initialize on module load
ensureTrackingDir();

// @route   POST /api/tracking-files/start
// @desc    Start a new tracking session (create folder and initial file)
// @access  Public
router.post('/start', async (req, res) => {
  console.log('📥 START request received:', req.body);
  try {
    const { user_code, session_code } = req.body;

    if (!user_code || !session_code) {
      return res.status(400).json({
        success: false,
        message: 'user_code and session_code are required'
      });
    }

    // Create folder path: tracking-data/{usercode}_{sessioncode}/
    const folderName = `${user_code}_${session_code}`;
    const folderPath = path.join(TRACKING_DATA_DIR, folderName);
    
    // Create folder if doesn't exist
    await fs.mkdir(folderPath, { recursive: true });

    // Initialize data structure
    const initialData = {
      user_code,
      session_code,
      recording_started_at: new Date().toISOString(),
      recording_ended_at: null,
      navigation_events: []
    };

    // Save initial file
    const filePath = path.join(folderPath, 'data.json');
    await fs.writeFile(filePath, JSON.stringify(initialData, null, 2));

    console.log(`✓ Session started: ${folderName}`);

    res.status(201).json({
      success: true,
      message: 'Tracking session started',
      data: {
        folder: folderName,
        path: folderPath,
        user_code,
        session_code
      }
    });

  } catch (error) {
    console.error('Error starting tracking session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/tracking-files/update
// @desc    Update tracking data with new events (overwrites file)
// @access  Public
router.post('/update', async (req, res) => {
  console.log('📥 UPDATE request received for:', req.body.user_code, req.body.session_code);
  try {
    const { user_code, session_code, data } = req.body;

    if (!user_code || !session_code || !data) {
      return res.status(400).json({
        success: false,
        message: 'user_code, session_code, and data are required'
      });
    }

    // Get folder and file path
    const folderName = `${user_code}_${session_code}`;
    const folderPath = path.join(TRACKING_DATA_DIR, folderName);
    const filePath = path.join(folderPath, 'data.json');

    // Ensure folder exists
    await fs.mkdir(folderPath, { recursive: true });

    // Write complete data (overwrite)
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));

    console.log(`✓ Updated: ${folderName} (${data.navigation_events?.length || 0} events)`);

    res.status(200).json({
      success: true,
      message: 'Data updated',
      data: {
        folder: folderName,
        event_count: data.navigation_events?.length || 0
      }
    });

  } catch (error) {
    console.error('Error updating tracking data:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/tracking-files/stop
// @desc    Finalize tracking session
// @access  Public
router.post('/stop', async (req, res) => {
  try {
    const { user_code, session_code } = req.body;

    if (!user_code || !session_code) {
      return res.status(400).json({
        success: false,
        message: 'user_code and session_code are required'
      });
    }

    const folderName = `${user_code}_${session_code}`;
    const filePath = path.join(TRACKING_DATA_DIR, folderName, 'data.json');

    // Read existing data
    const fileContent = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContent);

    // Update end time
    data.recording_ended_at = new Date().toISOString();

    // Save updated data
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));

    console.log(`✓ Session stopped: ${folderName}`);

    res.status(200).json({
      success: true,
      message: 'Tracking session stopped',
      data: {
        folder: folderName,
        event_count: data.navigation_events?.length || 0,
        duration_ms: new Date(data.recording_ended_at) - new Date(data.recording_started_at)
      }
    });

  } catch (error) {
    console.error('Error stopping tracking session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/tracking-files/session/:user_code/:session_code
// @desc    Get tracking session data
// @access  Public
router.get('/session/:user_code/:session_code', async (req, res) => {
  try {
    const { user_code, session_code } = req.params;

    const folderName = `${user_code}_${session_code}`;
    const filePath = path.join(TRACKING_DATA_DIR, folderName, 'data.json');

    const fileContent = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContent);

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    console.error('Error fetching session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/tracking-files/sessions
// @desc    List all tracking sessions
// @access  Public
router.get('/sessions', async (req, res) => {
  try {
    await ensureTrackingDir();
    
    const folders = await fs.readdir(TRACKING_DATA_DIR);
    const sessions = [];

    for (const folder of folders) {
      const filePath = path.join(TRACKING_DATA_DIR, folder, 'data.json');
      
      try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        
        sessions.push({
          folder,
          user_code: data.user_code,
          session_code: data.session_code,
          started_at: data.recording_started_at,
          ended_at: data.recording_ended_at,
          event_count: data.navigation_events?.length || 0,
          is_active: !data.recording_ended_at
        });
      } catch (err) {
        // Skip invalid folders
        console.warn(`Skipping invalid folder: ${folder}`);
      }
    }

    res.status(200).json({
      success: true,
      count: sessions.length,
      data: sessions
    });

  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   DELETE /api/tracking-files/session/:user_code/:session_code
// @desc    Delete a tracking session folder
// @access  Public
router.delete('/session/:user_code/:session_code', async (req, res) => {
  try {
    const { user_code, session_code } = req.params;

    const folderName = `${user_code}_${session_code}`;
    const folderPath = path.join(TRACKING_DATA_DIR, folderName);

    // Delete folder and all contents
    await fs.rm(folderPath, { recursive: true, force: true });

    console.log(`✓ Session deleted: ${folderName}`);

    res.status(200).json({
      success: true,
      message: 'Session deleted',
      data: { folder: folderName }
    });

  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/tracking-files/health
// @desc    Health check
// @access  Public
router.get('/health', async (req, res) => {
  console.log('📥 HEALTH check request received');
  try {
    await ensureTrackingDir();
    const folders = await fs.readdir(TRACKING_DATA_DIR);
    
    res.status(200).json({
      success: true,
      message: 'Tracking files service is running',
      data: {
        tracking_dir: TRACKING_DATA_DIR,
        session_count: folders.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Service error',
      error: error.message
    });
  }
});

// @route   GET /api/tracking-files/test
// @desc    Simple test endpoint
// @access  Public
router.get('/test', (req, res) => {
  console.log('📥 TEST request received');
  res.json({ success: true, message: 'API is working!', timestamp: new Date().toISOString() });
});

module.exports = router;

