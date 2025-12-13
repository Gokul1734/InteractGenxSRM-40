require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const postsRoutes = require('./routes/posts');
const trackingFilesRoutes = require('./routes/tracking-files');
const usersRoutes = require('./routes/users');
const sessionsRoutes = require('./routes/sessions');
const invitationsRoutes = require('./routes/invitations');
const pagesRoutes = require('./routes/pages');
const calloutsRoutes = require('./routes/callouts');
const teamAnalysisRoutes = require('./routes/teamAnalysis');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// MongoDB is optional - only connect if MONGO_URI is provided
if (process.env.MONGO_URI) {
  connectDB(process.env.MONGO_URI);
} else {
  console.log('MongoDB URI not provided - running without database');
}

// Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({ 
  origin: true,  // Allow all origins (including chrome-extension://)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// Increase JSON body limit to support image clips (data URLs) from the extension "Send to Pages"
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/tracking-files', trackingFilesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/invitations', invitationsRoutes);
app.use('/api/pages', pagesRoutes);
app.use('/api/callouts', calloutsRoutes);
app.use('/api/team-analysis', teamAnalysisRoutes);

// Health check
app.get('/', (req, res) => res.send({ ok: true }));

// Error handler (must be after routes)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start automatic team analysis service (runs every 1 minute)
  if (process.env.MONGO_URI) {
    const { processAllActiveSessions } = require('./services/teamAnalysisService');
    
    // Run immediately on startup
    setTimeout(() => {
      processAllActiveSessions();
    }, 5000); // Wait 5 seconds for DB connection
    
    // Then run every 1 minute (60000 ms)
    setInterval(() => {
      processAllActiveSessions();
    }, 60000);
    
    console.log('Team analysis service started (runs every 1 minute)');
  }
});
