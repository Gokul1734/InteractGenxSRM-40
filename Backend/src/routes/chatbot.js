const express = require('express');
const router = express.Router();
const { queryChatbot, getChatHistory } = require('../controllers/chatbotController');

// Query chatbot with ingested sources
router.post('/query', queryChatbot);

// Get chat history for a session
router.get('/history/:session_code', getChatHistory);

module.exports = router;

