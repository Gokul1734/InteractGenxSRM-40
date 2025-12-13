const express = require('express');
const router = express.Router();
const {
  ingestSources,
  getIngestedContent,
  checkIngested
} = require('../controllers/ingestionController');

// Ingest sources (pages and websites)
router.post('/ingest', ingestSources);

// Get ingested content
router.get('/content', getIngestedContent);

// Check if sources are already ingested
router.post('/check', checkIngested);

module.exports = router;

