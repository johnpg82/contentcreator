// Background service worker for Lead Management Assistant

// Install and activation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Lead Management Assistant installed');
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NEW_LEAD_MESSAGE') {
    handleNewLeadMessage(message.data);
    sendResponse({ success: true });
  }

  if (message.type === 'GENERATE_AI_RESPONSE') {
    generateAIResponse(message.data).then(sendResponse);
    return true; // Keep channel open for async response
  }

  return false;
});

/**
 * Handle new lead message
 */
async function handleNewLeadMessage(data) {
  try {
    // Get worker URL from settings
    const settings = await chrome.storage.sync.get({ workerUrl: '' });

    if (!settings.workerUrl) {
      console.warn('Worker URL not configured');
      return;
    }

    // Create or get lead
    const leadId = await ensureLeadExists(settings.workerUrl, data);

    // Create or get conversation
    const conversationId = await ensureConversationExists(
      settings.workerUrl,
      leadId,
      data.platform
    );

    // Save message
    await saveMessage(settings.workerUrl, {
      conversation_id: conversationId,
      lead_id: leadId,
      sender_type: 'lead',
      sender_name: data.senderName || data.leadEmail,
      content: data.content,
      message_type: 'text'
    });

    // Show notification
    const notificationSettings = await chrome.storage.sync.get({
      showNotifications: true
    });

    if (notificationSettings.showNotifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'New Lead Message',
        message: `From: ${data.senderName || 'Unknown'}\n${data.content.substring(0, 100)}...`
      });
    }

  } catch (error) {
    console.error('Error handling lead message:', error);
  }
}

/**
 * Ensure lead exists, create if not
 */
async function ensureLeadExists(workerUrl, data) {
  // Check if lead exists by email
  if (data.leadEmail) {
    try {
      const response = await fetch(
        `${workerUrl}/api/leads?email=${encodeURIComponent(data.leadEmail)}`
      );
      const result = await response.json();

      if (result.success && result.leads && result.leads.length > 0) {
        return result.leads[0].id;
      }
    } catch (error) {
      console.error('Error checking existing lead:', error);
    }
  }

  // Create new lead
  const response = await fetch(`${workerUrl}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: data.leadEmail || null,
      name: data.leadName || null,
      phone: data.leadPhone || null,
      company: data.leadCompany || null,
      source_url: data.sourceUrl || 'unknown',
      source_platform: data.platform || 'website',
      priority: 'medium'
    })
  });

  const result = await response.json();
  return result.id;
}

/**
 * Ensure conversation exists
 */
async function ensureConversationExists(workerUrl, leadId, platform) {
  // For simplicity, create a new conversation each time
  // In production, you might want to check for active conversations first
  const response = await fetch(`${workerUrl}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lead_id: leadId,
      platform: platform || 'website'
    })
  });

  const result = await response.json();
  return result.id;
}

/**
 * Save message
 */
async function saveMessage(workerUrl, messageData) {
  const response = await fetch(`${workerUrl}/api/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messageData)
  });

  return await response.json();
}

/**
 * Generate AI response
 */
async function generateAIResponse(data) {
  try {
    const settings = await chrome.storage.sync.get({ workerUrl: '' });

    if (!settings.workerUrl) {
      return { success: false, error: 'Worker URL not configured' };
    }

    const response = await fetch(`${workerUrl}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: data.conversationId,
        lead_id: data.leadId,
        context: data.context || null
      })
    });

    return await response.json();

  } catch (error) {
    console.error('Error generating AI response:', error);
    return { success: false, error: error.message };
  }
}
