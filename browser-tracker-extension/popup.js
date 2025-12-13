// Popup UI Controller for Browser Navigation Tracker
// Uses configuration from config.js (API_BASE_URL, DASHBOARD_URL)

// DOM Elements
const userCodeInput = document.getElementById('userCode');
const sessionCodeInput = document.getElementById('sessionCode');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDisplay = document.getElementById('statusDisplay');
const validationError = document.getElementById('validationError');
const errorMessage = document.getElementById('errorMessage');
const dashboardLink = document.getElementById('dashboardLink');
const sessionInfoSection = document.getElementById('sessionInfoSection');
const sessionName = document.getElementById('sessionName');
const memberList = document.getElementById('memberList');

// Callout DOM Elements
const calloutSection = document.getElementById('calloutSection');
const calloutMessage = document.getElementById('calloutMessage');
const calloutBtn = document.getElementById('calloutBtn');
const calloutStatus = document.getElementById('calloutStatus');

// API_ROOT is already available from config.js

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
  userCodeInput.addEventListener('input', () => {
    hideValidationError();
    hideSessionInfo();
  });
  
  sessionCodeInput.addEventListener('input', () => {
    hideValidationError();
    // Auto-fetch session info when session code is entered
    const sessionCode = sessionCodeInput.value.trim().toUpperCase();
    if (sessionCode.length === 7) {
      loadSessionInfo(sessionCode);
    } else {
      hideSessionInfo();
    }
  });

  // Limit input to 7 characters and uppercase
  userCodeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  });

  sessionCodeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  });
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
      // Load session info if session code exists
      if (result.session_code.length === 7) {
        loadSessionInfo(result.session_code);
      }
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
  startBtn.textContent = 'Start';
  
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
    
    // Show callout section when recording
    if (calloutSection) {
      calloutSection.style.display = 'block';
    }
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
    
    // Hide callout section when not recording
    if (calloutSection) {
      calloutSection.style.display = 'none';
    }
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

// Fetch session info and members
async function loadSessionInfo(sessionCode) {
  if (!sessionCode || sessionCode.length !== 7) {
    hideSessionInfo();
    return;
  }

  try {
    // Show loading state
    sessionInfoSection.style.display = 'block';
    sessionName.textContent = 'Loading...';
    memberList.innerHTML = '<div class="loading">Loading members...</div>';

    // Fetch session details
    const sessionResponse = await fetch(`${API_ROOT}/sessions/${sessionCode}`);
    if (!sessionResponse.ok) {
      throw new Error('Session not found');
    }
    const sessionData = await sessionResponse.json();

    if (sessionData.success && sessionData.data) {
      const session = sessionData.data;
      sessionName.textContent = session.session_name || `Session ${sessionCode}`;

      // Fetch session members
      const membersResponse = await fetch(`${API_ROOT}/sessions/${sessionCode}/members?active_only=true`);
      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        if (membersData.success && membersData.data) {
          displayMembers(membersData.data);
        } else {
          memberList.innerHTML = '<div class="empty-state">No active members</div>';
        }
      } else {
        memberList.innerHTML = '<div class="empty-state">Unable to load members</div>';
      }
    } else {
      hideSessionInfo();
    }
  } catch (error) {
    console.error('Error loading session info:', error);
    sessionInfoSection.style.display = 'none';
  }
}

// Display team members
function displayMembers(members) {
  if (!members || members.length === 0) {
    memberList.innerHTML = '<div class="empty-state">No active members</div>';
    return;
  }

  memberList.innerHTML = members.map(member => {
    const initials = member.user_name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
    
    return `
      <div class="member-item">
        <div class="member-avatar">${initials}</div>
        <div class="member-info">
          <div class="member-name">${member.user_name || 'Unknown'}</div>
          <div class="member-code">${member.user_code}</div>
        </div>
        <div class="member-status" title="Active"></div>
      </div>
    `;
  }).join('');
}

// Hide session info section
function hideSessionInfo() {
  sessionInfoSection.style.display = 'none';
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
  if (!userCode || userCode.length !== 7) {
    showValidationError('Please enter a valid 7-character User Code');
    return;
  }

  if (!sessionCode || sessionCode.length !== 7) {
    showValidationError('Please enter a valid 7-character Session Code');
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
      startBtn.textContent = 'Start';
      return;
    }

    // Validation passed - proceed with recording
    console.log('Validation passed:', validationResult.data);

    // Load session info if not already loaded
    await loadSessionInfo(sessionCode);

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
    startBtn.textContent = 'Start';
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

// ==================== CALLOUT FUNCTIONALITY ====================

// Show callout status message
function showCalloutStatus(message, isSuccess) {
  if (calloutStatus) {
    calloutStatus.textContent = message;
    calloutStatus.className = `callout-status ${isSuccess ? 'success' : 'error'}`;
    calloutStatus.classList.remove('hidden');
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      calloutStatus.classList.add('hidden');
    }, 3000);
  }
}

// Create Callout
if (calloutBtn) {
  calloutBtn.addEventListener('click', async () => {
    const userCode = userCodeInput.value.trim().toUpperCase();
    const sessionCode = sessionCodeInput.value.trim().toUpperCase();
    const message = calloutMessage ? calloutMessage.value.trim() : '';

    // Validate we have user and session codes
    if (!userCode || !sessionCode) {
      showCalloutStatus('Missing user or session code', false);
      return;
    }

    // Disable button during request
    calloutBtn.disabled = true;
    calloutBtn.innerHTML = '<span class="callout-icon">⏳</span> Creating callout...';

    // Set a timeout to reset button in case of hung request
    const resetTimeout = setTimeout(() => {
      console.warn('Callout request timeout - resetting button');
      calloutBtn.disabled = false;
      calloutBtn.innerHTML = '<span class="callout-icon">📍</span> Call Attention to This Page';
      showCalloutStatus('Request timed out. Please try again.', false);
    }, 20000); // 20 second safety timeout

    try {
      console.log('Sending CREATE_CALLOUT message...');
      
      // Send message to background script to create callout
      const response = await chrome.runtime.sendMessage({
        action: 'CREATE_CALLOUT',
        user_code: userCode,
        session_code: sessionCode,
        message: message
      });

      clearTimeout(resetTimeout);
      console.log('Callout response:', response);

      if (response && response.success) {
        showCalloutStatus('✓ Callout sent to your team!', true);
        // Clear message input
        if (calloutMessage) {
          calloutMessage.value = '';
        }
      } else {
        showCalloutStatus(response?.error || 'Failed to create callout', false);
      }
    } catch (error) {
      clearTimeout(resetTimeout);
      console.error('Error creating callout:', error);
      showCalloutStatus(error.message || 'Failed to create callout', false);
    } finally {
      // Re-enable button
      calloutBtn.disabled = false;
      calloutBtn.innerHTML = '<span class="callout-icon">📍</span> Call Attention to This Page';
    }
  });
}
