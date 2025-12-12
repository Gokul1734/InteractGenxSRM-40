// Frontend Configuration
// Automatically uses the correct API URL based on environment

const config = {
  // API Base URL - loaded from environment variables
  API_BASE_URL: 'http://localhost:5000/api',
  
  // Environment
  ENVIRONMENT: import.meta.env.VITE_ENVIRONMENT || 'development',
  
  // Derived API endpoints
  get API_TRACKING_FILES() {
    return `${this.API_BASE_URL}/tracking-files`;
  },
  
  get API_USERS() {
    return `${this.API_BASE_URL}/users`;
  },
  
  get API_SESSIONS() {
    return `${this.API_BASE_URL}/sessions`;
  },
  
  get API_INVITATIONS() {
    return `${this.API_BASE_URL}/invitations`;
  },
  
  // Helper to check if we're in production
  isProduction() {
    return this.ENVIRONMENT === 'production';
  },
  
  // Helper to check if we're in development
  isDevelopment() {
    return this.ENVIRONMENT === 'development';
  }
};

// Log configuration on load (only in development)
if (config.isDevelopment()) {
  console.log('[Config] Environment:', config.ENVIRONMENT);
  console.log('[Config] API URL:', config.API_BASE_URL);
}

export default config;

