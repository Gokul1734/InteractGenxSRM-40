// Popup UI Controller for Browser Navigation Tracker

// DOM Elements
const userCodeInput = document.getElementById('userCode');
const sessionCodeInput = document.getElementById('sessionCode');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const exportBtn = document.getElementById('exportBtn');
const statusDisplay = document.getElementById('statusDisplay');
const eventCount = document.getElementById('eventCount');
const countNumber = document.getElementById('countNumber');
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
      'is_recording',
      'event_count'
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
    updateUI(isRecording, result.event_count || 0);

  } catch (error) {
    console.error('Error loading state:', error);
  }
}

// Update UI based on recording state
function updateUI(isRecording, count = 0) {
  if (isRecording) {
    // Recording is ON
    statusDisplay.textContent = 'Recording: ON';
    statusDisplay.className = 'status recording';
    
    startBtn.disabled = true;
    stopBtn.disabled = false;
    
    userCodeInput.disabled = true;
    sessionCodeInput.disabled = true;
    
    eventCount.classList.remove('hidden');
    countNumber.textContent = count;
    
    exportBtn.classList.add('hidden');
    
    // Show auto-save info
    autoSaveInfo.classList.remove('hidden');
    const userCode = userCodeInput.value;
    const sessionCode = sessionCodeInput.value;
    filenameDisplay.textContent = `Backend/tracking-data/${userCode}_${sessionCode}/data.json`;
  } else {
    // Recording is OFF
    statusDisplay.textContent = 'Recording: OFF';
    statusDisplay.className = 'status stopped';
    
    startBtn.disabled = false;
    stopBtn.disabled = true;
    
    userCodeInput.disabled = false;
    sessionCodeInput.disabled = false;
    
    // Hide auto-save info
    autoSaveInfo.classList.add('hidden');
    
    // Show export button if there's data
    if (count > 0) {
      exportBtn.classList.remove('hidden');
      eventCount.classList.remove('hidden');
      countNumber.textContent = count;
    } else {
      exportBtn.classList.add('hidden');
      eventCount.classList.add('hidden');
    }
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
      is_recording: true,
      event_count: 0
    });

    // Send message to background script to start recording
    await chrome.runtime.sendMessage({
      action: 'START_RECORDING',
      user_code: userCode,
      session_code: sessionCode
    });

    updateUI(true, 0);
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

    updateUI(false, response.event_count || 0);
    console.log('Recording stopped');

  } catch (error) {
    console.error('Error stopping recording:', error);
    alert('Failed to stop recording');
  }
});

// Export JSON
exportBtn.addEventListener('click', async () => {
  try {
    // Request data from background script
    const response = await chrome.runtime.sendMessage({
      action: 'GET_RECORDING_DATA'
    });

    if (!response || !response.data) {
      alert('No data available to export');
      return;
    }

    // Create downloadable JSON file
    const jsonString = JSON.stringify(response.data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `navigation_tracking_${response.data.user_code}_${response.data.session_code}_${timestamp}.json`;

    // Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('JSON exported successfully');

  } catch (error) {
    console.error('Error exporting JSON:', error);
    alert('Failed to export JSON');
  }
});

// Listen for updates from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'EVENT_COUNT_UPDATE') {
    countNumber.textContent = message.count;
  }
});

