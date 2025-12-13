// Configuration for Browser Navigation Tracker Extension
// This file centralizes all environment-specific URLs

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================
// Set to 'production' for deployed backend, 'development' for local testing
// Defaulting to local per project setup.
const ENVIRONMENT = 'development';

// ============================================================================
// URL CONFIGURATIONS
// ============================================================================
const CONFIG = {
  production: {
    API_BASE_URL: 'https://interactgenxsrm-40-1.onrender.com/api/tracking-files',
    DASHBOARD_URL: 'https://interactgenxsrm-40.vercel.app', // Update when frontend is deployed
  },
  development: {
    API_BASE_URL: 'http://localhost:5000/api/tracking-files',
    DASHBOARD_URL: 'http://localhost:5173',
  }
};

// ============================================================================
// EXPORTED CONFIGURATION
// ============================================================================
const API_BASE_URL = CONFIG[ENVIRONMENT].API_BASE_URL;
const DASHBOARD_URL = CONFIG[ENVIRONMENT].DASHBOARD_URL;
// Derive base /api root and pages API URL from tracking-files URL
const API_ROOT = API_BASE_URL.replace(/\/tracking-files\/?$/, '');
const PAGES_BASE_URL = `${API_ROOT}/pages`;

// Log current environment on load
console.log(`[Config] Environment: ${ENVIRONMENT}`);
console.log(`[Config] API URL: ${API_BASE_URL}`);
console.log(`[Config] Dashboard URL: ${DASHBOARD_URL}`);
console.log(`[Config] Pages API URL: ${PAGES_BASE_URL}`);

