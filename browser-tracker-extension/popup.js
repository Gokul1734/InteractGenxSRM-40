// Popup UI Controller for Browser Navigation Tracker
// Uses configuration from config.js (API_BASE_URL, DASHBOARD_URL)

// DOM Elements
const userCodeInput = document.getElementById('userCode');
const sessionCodeInput = document.getElementById('sessionCode');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDisplay = document.getElementById('statusDisplay');
const inputSection = document.getElementById('inputSection');
const autoSaveInfo = document.getElementById('autoSaveInfo');
const filenameDisplay = document.getElementById('filename');
const validationError = document.getElementById('validationError');
const errorMessage = document.getElementById('errorMessage');
const dashboardLink = document.getElementById('dashboardLink');

// Initialize popup state
document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  
  // Add click handler for dashboard button
  if (dashboardLink) {
    dashboardLink.addEventListener('click', (e) => {
      e.preventDefault();
      openDashboard();
    });
  }
  
  // Hide validation error when user starts typing
  userCodeInput.addEventListener('input', hideValidationError);
  sessionCodeInput.addEventListener('input', hideValidationError);
});

// Load current recording state
async function loadState() {
  try {
    const result = await chrome.storage.local.get([
      'user_code',
      'session_code',
      'is_recording'
    ]);

    // Restore saved codes
    if (result.user_code) {
      userCodeInput.value = result.user_code;
    }
    if (result.session_code) {
      sessionCodeInput.value = result.session_code;
    }

    // Update UI based on recording state
    const isRecording = result.is_recording || false;
    updateUI(isRecording);

  } catch (error) {
    console.error('Error loading state:', error);
  }
}

// Update UI based on recording state
function updateUI(isRecording, count = 0) {
  // Hide validation error when updating UI
  hideValidationError();
  
  // Reset start button text
  startBtn.textContent = 'Start Recording';
  
  if (isRecording) {
    // Recording is ON
    statusDisplay.innerHTML = `
      <div class="status-icon recording"></div>
      <div class="status-text">Recording</div>
    `;
    statusDisplay.className = 'status recording';
    
    startBtn.disabled = true;
    stopBtn.disabled = false;
    
    userCodeInput.disabled = true;
    sessionCodeInput.disabled = true;
    
    // Show auto-save info
    autoSaveInfo.classList.remove('hidden');
    const userCode = userCodeInput.value;
    const sessionCode = sessionCodeInput.value;
    filenameDisplay.textContent = `Backend/tracking-data/${userCode}_${sessionCode}/data.json`;
  } else {
    // Recording is OFF
    statusDisplay.innerHTML = `
      <div class="status-icon idle"></div>
      <div class="status-text">Idle</div>
    `;
    statusDisplay.className = 'status idle';
    
    startBtn.disabled = false;
    stopBtn.disabled = true;
    
    userCodeInput.disabled = false;
    sessionCodeInput.disabled = false;
    
    // Hide auto-save info
    autoSaveInfo.classList.add('hidden');
  }
}

// Validate user code and session code against backend
async function validateCodes(userCode, sessionCode) {
  try {
    const response = await fetch(`${API_BASE_URL}/validate/${userCode}/${sessionCode}`);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Validation API error:', error);
    return {
      success: false,
      valid: false,
      message: 'Unable to connect to backend. Please ensure the server is running.',
      errors: ['Backend connection failed']
    };
  }
}

// Show validation error with dashboard link
function showValidationError(message) {
  if (validationError) {
    validationError.classList.remove('hidden');
    if (errorMessage) {
      errorMessage.textContent = message;
    }
    if (dashboardLink) {
      dashboardLink.href = DASHBOARD_URL;
    }
  }
}

// Hide validation error
function hideValidationError() {
  if (validationError) {
    validationError.classList.add('hidden');
  }
}

// Open dashboard in new tab
function openDashboard() {
  chrome.tabs.create({ url: DASHBOARD_URL });
}

// Start Recording
startBtn.addEventListener('click', async () => {
  const userCode = userCodeInput.value.trim().toUpperCase();
  const sessionCode = sessionCodeInput.value.trim().toUpperCase();

  // Hide any previous error
  hideValidationError();

  // Basic format validation
  if (!userCode || userCode === '') {
    showValidationError('Please enter a valid User Code');
    return;
  }

  if (!sessionCode || sessionCode === '') {
    showValidationError('Please enter a Session Code');
    return;
  }

  // Show loading state
  startBtn.disabled = true;
  startBtn.textContent = 'Validating...';

  try {
    // Validate user and session codes against backend
    const validationResult = await validateCodes(userCode, sessionCode);

    if (!validationResult.valid) {
      // Show error and prompt to navigate to dashboard
      showValidationError(validationResult.message || 'Invalid user code or session code');
      startBtn.disabled = false;
      startBtn.textContent = 'Start Recording';
      return;
    }

    // Validation passed - proceed with recording
    console.log('Validation passed:', validationResult.data);

    // Save codes to storage
    await chrome.storage.local.set({
      user_code: userCode,
      session_code: sessionCode,
      is_recording: true
    });

    // Send message to background script to start recording
    await chrome.runtime.sendMessage({
      action: 'START_RECORDING',
      user_code: userCode,
      session_code: sessionCode
    });

    updateUI(true);
    console.log('Recording started');

  } catch (error) {
    console.error('Error starting recording:', error);
    showValidationError('Failed to start recording. Please try again.');
    startBtn.disabled = false;
    startBtn.textContent = 'Start Recording';
  }
});

// Stop Recording
stopBtn.addEventListener('click', async () => {
  try {
    // Send message to background script to stop recording
    const response = await chrome.runtime.sendMessage({
      action: 'STOP_RECORDING'
    });

    // Update storage
    await chrome.storage.local.set({
      is_recording: false
    });

    updateUI(false);
    console.log('Recording stopped');

  } catch (error) {
    console.error('Error stopping recording:', error);
    alert('Failed to stop recording');
  }
});

// No export functionality needed - auto-saves to backend

