const express = require('express');
const router = express.Router();

// Placeholder posts routes
// TODO: Implement posts routes

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Posts service running' });
});

module.exports = router;

