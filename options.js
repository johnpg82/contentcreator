// Options page script for managing extension settings

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('settingsForm');
  const workerUrlInput = document.getElementById('workerUrl');
  const autoSaveCheckbox = document.getElementById('autoSave');
  const showNotificationsCheckbox = document.getElementById('showNotifications');
  const testBtn = document.getElementById('testBtn');
  const statusMessage = document.getElementById('statusMessage');

  // Load saved settings
  loadSettings();

  // Save settings
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings();
  });

  // Test connection
  testBtn.addEventListener('click', () => {
    testConnection();
  });

  function loadSettings() {
    chrome.storage.sync.get({
      workerUrl: '',
      autoSave: false,
      showNotifications: true
    }, (items) => {
      workerUrlInput.value = items.workerUrl;
      autoSaveCheckbox.checked = items.autoSave;
      showNotificationsCheckbox.checked = items.showNotifications;
    });
  }

  function saveSettings() {
    const workerUrl = workerUrlInput.value.trim();

    // Basic validation
    if (workerUrl && !isValidUrl(workerUrl)) {
      showStatus('Please enter a valid URL', 'error');
      return;
    }

    const settings = {
      workerUrl: workerUrl,
      autoSave: autoSaveCheckbox.checked,
      showNotifications: showNotificationsCheckbox.checked
    };

    chrome.storage.sync.set(settings, () => {
      showStatus('Settings saved successfully!', 'success');

      // Clear success message after 3 seconds
      setTimeout(() => {
        hideStatus();
      }, 3000);
    });
  }

  async function testConnection() {
    const workerUrl = workerUrlInput.value.trim();

    if (!workerUrl) {
      showStatus('Please enter a Worker URL first', 'error');
      return;
    }

    if (!isValidUrl(workerUrl)) {
      showStatus('Please enter a valid URL', 'error');
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';

    try {
      const response = await fetch(workerUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        showStatus(`Connection successful! Service: ${data.service || 'Worker'}`, 'success');
      } else {
        showStatus(`Connection failed: HTTP ${response.status}`, 'error');
      }
    } catch (error) {
      showStatus(`Connection failed: ${error.message}`, 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = 'Test Connection';
    }
  }

  function isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
  }

  function hideStatus() {
    statusMessage.className = 'status-message';
  }
});
