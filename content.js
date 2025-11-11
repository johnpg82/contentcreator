// Content script for Lead Management Assistant
// Captures chat messages from web pages

(function() {
  'use strict';

  let captureEnabled = false;
  let observerActive = false;
  let chatObserver = null;

  // Check if capture is enabled for this site
  chrome.storage.sync.get({ autoCapture: false, captureMode: 'manual' }, (settings) => {
    if (settings.autoCapture || settings.captureMode === 'auto') {
      initializeCapture();
    }
  });

  /**
   * Initialize chat capture
   */
  function initializeCapture() {
    captureEnabled = true;
    console.log('Lead capture initialized on:', window.location.href);

    // Start observing for chat messages
    startChatObserver();

    // Listen for manual capture requests
    listenForManualCapture();
  }

  /**
   * Start observing DOM for chat messages
   */
  function startChatObserver() {
    if (observerActive) return;

    // Common chat widget selectors
    const chatSelectors = [
      // Generic chat containers
      '[class*="chat"]',
      '[class*="message"]',
      '[class*="conversation"]',
      '[id*="chat"]',
      '[id*="message"]',

      // Popular chat platforms
      '.intercom-container',
      '.drift-widget',
      '.hubspot-messages-iframe',
      '.crisp-client',
      '#tawk-chat',
      '.zendesk-widget',
      '.livechat-widget',
      '.olark-box'
    ];

    // Find chat container
    const chatContainer = findChatContainer(chatSelectors);

    if (chatContainer) {
      console.log('Chat container found:', chatContainer);

      // Observe for new messages
      chatObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) { // Element node
              const message = extractMessageFromNode(node);
              if (message) {
                handleNewMessage(message);
              }
            }
          });
        });
      });

      chatObserver.observe(chatContainer, {
        childList: true,
        subtree: true
      });

      observerActive = true;
    }
  }

  /**
   * Find chat container element
   */
  function findChatContainer(selectors) {
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        if (element.offsetHeight > 0 && element.offsetWidth > 0) {
          return element;
        }
      }
    }
    return null;
  }

  /**
   * Extract message data from DOM node
   */
  function extractMessageFromNode(node) {
    // Check if node contains message content
    const textContent = node.textContent?.trim();
    if (!textContent || textContent.length < 3) {
      return null;
    }

    // Check if this is from a lead (not from agent/bot)
    const isFromLead = detectIfFromLead(node);
    if (!isFromLead) {
      return null;
    }

    return {
      content: textContent,
      timestamp: new Date().toISOString(),
      sender: extractSenderInfo(node)
    };
  }

  /**
   * Detect if message is from lead (not agent/bot)
   */
  function detectIfFromLead(node) {
    const className = node.className || '';
    const dataset = node.dataset || {};

    // Common patterns for user/customer messages
    const leadPatterns = [
      'user', 'customer', 'visitor', 'guest', 'client',
      'from-user', 'from-customer', 'sender-user'
    ];

    // Common patterns for agent/bot messages (to exclude)
    const agentPatterns = [
      'agent', 'bot', 'support', 'operator', 'assistant',
      'from-agent', 'from-bot', 'sender-agent'
    ];

    const classLower = className.toLowerCase();
    const dataRole = (dataset.role || '').toLowerCase();
    const dataType = (dataset.type || '').toLowerCase();

    // Check if it's an agent/bot message (exclude)
    for (const pattern of agentPatterns) {
      if (classLower.includes(pattern) || dataRole.includes(pattern) || dataType.includes(pattern)) {
        return false;
      }
    }

    // Check if it's a lead message
    for (const pattern of leadPatterns) {
      if (classLower.includes(pattern) || dataRole.includes(pattern) || dataType.includes(pattern)) {
        return true;
      }
    }

    // If uncertain, assume it's from lead (can be configured)
    return true;
  }

  /**
   * Extract sender information
   */
  function extractSenderInfo(node) {
    // Try to find sender name/email from nearby elements
    const parent = node.parentElement;
    if (!parent) return {};

    // Look for name elements
    const nameElements = parent.querySelectorAll('[class*="name"], [class*="author"], [class*="sender"]');
    const name = nameElements[0]?.textContent?.trim();

    // Look for email (less common in chat but worth checking)
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/;
    const emailMatch = parent.textContent.match(emailRegex);

    return {
      name: name || null,
      email: emailMatch ? emailMatch[0] : null
    };
  }

  /**
   * Handle new message detected
   */
  function handleNewMessage(message) {
    console.log('New lead message detected:', message);

    // Prepare data for background script
    const data = {
      content: message.content,
      leadName: message.sender.name || 'Unknown',
      leadEmail: message.sender.email || null,
      sourceUrl: window.location.href,
      platform: detectPlatform(),
      timestamp: message.timestamp
    };

    // Send to background script
    chrome.runtime.sendMessage({
      type: 'NEW_LEAD_MESSAGE',
      data: data
    }, (response) => {
      if (response && response.success) {
        console.log('Message saved successfully');
      }
    });
  }

  /**
   * Detect chat platform
   */
  function detectPlatform() {
    const url = window.location.hostname;
    const html = document.documentElement.outerHTML;

    if (html.includes('intercom')) return 'Intercom';
    if (html.includes('drift')) return 'Drift';
    if (html.includes('hubspot')) return 'HubSpot';
    if (html.includes('crisp')) return 'Crisp';
    if (html.includes('tawk')) return 'Tawk.to';
    if (html.includes('zendesk')) return 'Zendesk';
    if (html.includes('livechat')) return 'LiveChat';
    if (html.includes('olark')) return 'Olark';

    return url;
  }

  /**
   * Listen for manual capture requests
   */
  function listenForManualCapture() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'captureChats') {
        const messages = manualCaptureMessages();
        sendResponse({ success: true, messages: messages });
      }

      if (request.action === 'toggleCapture') {
        captureEnabled = !captureEnabled;
        if (captureEnabled) {
          startChatObserver();
        } else {
          stopChatObserver();
        }
        sendResponse({ success: true, enabled: captureEnabled });
      }

      return true;
    });
  }

  /**
   * Manually capture all visible messages
   */
  function manualCaptureMessages() {
    const messages = [];

    // Generic message selectors
    const messageSelectors = [
      '[class*="message"]',
      '[class*="chat-message"]',
      '[class*="conversation-message"]'
    ];

    messageSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const message = extractMessageFromNode(element);
        if (message) {
          messages.push(message);
        }
      });
    });

    return messages;
  }

  /**
   * Stop chat observer
   */
  function stopChatObserver() {
    if (chatObserver) {
      chatObserver.disconnect();
      chatObserver = null;
      observerActive = false;
    }
  }

  /**
   * Page navigation detection
   */
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log('URL changed to:', url);

      // Restart observer on navigation
      if (captureEnabled) {
        stopChatObserver();
        setTimeout(startChatObserver, 1000);
      }
    }
  }).observe(document, { subtree: true, childList: true });

  console.log('Lead Management Assistant content script loaded');
})();
