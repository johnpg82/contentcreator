// Popup script for the TheBash.com Content Reader extension

document.addEventListener('DOMContentLoaded', () => {
  const extractBtn = document.getElementById('extractBtn');
  const copyBtn = document.getElementById('copyBtn');
  const saveBtn = document.getElementById('saveBtn');
  const settingsLink = document.getElementById('settingsLink');
  const statusDiv = document.getElementById('status');
  const contentDiv = document.getElementById('content');

  let currentContent = null;

  // Function to update status message
  function setStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
  }

  // Function to display content
  function displayContent(data) {
    if (!data || !data.quotes || data.quotes.length === 0) {
      contentDiv.innerHTML = '<div class="empty-state">No quotes found on this page</div>';
      return;
    }

    let html = '';
    data.quotes.forEach((quote, index) => {
      html += `
        <div class="quote-item">
          <div class="quote-text">${escapeHtml(quote.text)}</div>
          <div class="quote-meta">Quote #${index + 1}</div>
        </div>
      `;
    });

    contentDiv.innerHTML = html;
    currentContent = data;
  }

  // Function to escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Function to copy content to clipboard
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      setStatus('Content copied to clipboard!', 'success');
      setTimeout(() => {
        setStatus('Ready to extract content from thebash.com', 'info');
      }, 2000);
    }).catch(err => {
      setStatus('Failed to copy content', 'error');
      console.error('Copy failed:', err);
    });
  }

  // Extract content from the current tab
  extractBtn.addEventListener('click', () => {
    setStatus('Extracting content...', 'info');
    extractBtn.disabled = true;

    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];

      // Check if we're on thebash.com
      if (!activeTab.url || !activeTab.url.includes('thebash.com')) {
        setStatus('Please navigate to thebash.com first', 'error');
        extractBtn.disabled = false;
        contentDiv.innerHTML = '<div class="empty-state">This extension only works on thebash.com</div>';
        return;
      }

      // Send message to content script to extract content
      chrome.tabs.sendMessage(activeTab.id, { action: 'extractContent' }, (response) => {
        extractBtn.disabled = false;

        if (chrome.runtime.lastError) {
          setStatus('Error: Please refresh the page and try again', 'error');
          console.error(chrome.runtime.lastError);
          return;
        }

        if (response && response.success) {
          setStatus(`Extracted ${response.data.quotes.length} quotes`, 'success');
          displayContent(response.data);
        } else {
          setStatus('Failed to extract content', 'error');
        }
      });
    });
  });

  // Copy all quotes to clipboard
  copyBtn.addEventListener('click', () => {
    if (!currentContent || !currentContent.quotes || currentContent.quotes.length === 0) {
      setStatus('No content to copy', 'error');
      return;
    }

    const text = currentContent.quotes
      .map((quote, index) => `[Quote #${index + 1}]\n${quote.text}`)
      .join('\n\n---\n\n');

    const fullText = `Content from ${currentContent.url}\nExtracted at: ${currentContent.timestamp}\n\n${text}`;
    copyToClipboard(fullText);
  });

  // Save content to Cloudflare Worker
  saveBtn.addEventListener('click', async () => {
    if (!currentContent || !currentContent.quotes || currentContent.quotes.length === 0) {
      setStatus('No content to save', 'error');
      return;
    }

    // Get worker URL from settings
    chrome.storage.sync.get({ workerUrl: '' }, async (items) => {
      if (!items.workerUrl) {
        setStatus('Please configure Worker endpoint in settings', 'error');
        return;
      }

      await saveToWorker(items.workerUrl, currentContent);
    });
  });

  // Open settings page
  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // Function to save content to worker
  async function saveToWorker(workerUrl, content) {
    saveBtn.disabled = true;
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';

    try {
      const response = await fetch(`${workerUrl}/api/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(content)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus(`Saved successfully! ID: ${data.id}`, 'success');

        // Show notification if enabled
        chrome.storage.sync.get({ showNotifications: true }, (items) => {
          if (items.showNotifications) {
            chrome.notifications?.create({
              type: 'basic',
              iconUrl: 'icons/icon48.png',
              title: 'Content Saved',
              message: `${data.quotesCount} quotes saved to worker`
            });
          }
        });
      } else {
        setStatus(`Save failed: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      setStatus(`Save failed: ${error.message}`, 'error');
      console.error('Save error:', error);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
    }
  }

  // Load any previously stored content
  chrome.storage.local.get(['latestContent'], (result) => {
    if (result.latestContent) {
      displayContent(result.latestContent);
      setStatus(`Showing cached content (${result.latestContent.quotes.length} quotes)`, 'info');
    }
  });
});
