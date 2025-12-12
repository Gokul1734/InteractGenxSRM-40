// Popup UI Controller for Browser Navigation Tracker

// DOM Elements
const userCodeInput = document.getElementById('userCode');
const sessionCodeInput = document.getElementById('sessionCode');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDisplay = document.getElementById('statusDisplay');
const inputSection = document.getElementById('inputSection');
const autoSaveInfo = document.getElementById('autoSaveInfo');
const filenameDisplay = document.getElementById('filename');

// Initialize popup state
document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
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
function updateUI(isRecording) {
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

// Start Recording
startBtn.addEventListener('click', async () => {
  const userCode = parseInt(userCodeInput.value);
  const sessionCode = sessionCodeInput.value.trim();

  // Validation
  if (!userCode || isNaN(userCode)) {
    alert('Please enter a valid numeric User Code');
    return;
  }

  if (!sessionCode) {
    alert('Please enter a Session Code');
    return;
  }

  try {
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
    alert('Failed to start recording');
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

