/**
 * Lead Management System - Cloudflare Worker
 *
 * Complete lead management API with AI response generation,
 * D1 database storage, and R2 file storage
 */

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return corsResponse();
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // API Routes
      if (path.startsWith('/api/')) {
        return await handleAPI(request, env, path, url);
      }

      // Dashboard UI
      if (path === '/' || path === '/dashboard') {
        return serveHTML(getDashboardHTML(), 'Lead Management Dashboard');
      }

      // 404
      return jsonResponse({ error: 'Not Found' }, 404);

    } catch (error) {
      console.error('Error:', error);
      return jsonResponse({ error: error.message }, 500);
    }
  }
};

/**
 * API Route Handler
 */
async function handleAPI(request, env, path, url) {
  const method = request.method;

  // Leads endpoints
  if (path === '/api/leads' && method === 'POST') {
    return await createLead(request, env);
  }
  if (path === '/api/leads' && method === 'GET') {
    return await getLeads(request, env, url);
  }
  if (path.match(/^\/api\/leads\/[^/]+$/) && method === 'GET') {
    const id = path.split('/')[3];
    return await getLead(env, id);
  }
  if (path.match(/^\/api\/leads\/[^/]+$/) && method === 'PUT') {
    const id = path.split('/')[3];
    return await updateLead(request, env, id);
  }

  // Conversations endpoints
  if (path === '/api/conversations' && method === 'POST') {
    return await createConversation(request, env);
  }
  if (path.match(/^\/api\/conversations\/[^/]+$/) && method === 'GET') {
    const id = path.split('/')[3];
    return await getConversation(env, id);
  }

  // Messages endpoints
  if (path === '/api/messages' && method === 'POST') {
    return await createMessage(request, env);
  }
  if (path.match(/^\/api\/conversations\/[^/]+\/messages$/) && method === 'GET') {
    const conversationId = path.split('/')[3];
    return await getMessages(env, conversationId);
  }

  // AI Response endpoints
  if (path === '/api/ai/generate' && method === 'POST') {
    return await generateAIResponse(request, env);
  }
  if (path === '/api/ai/responses' && method === 'GET') {
    return await getAIResponses(env, url);
  }
  if (path.match(/^\/api\/ai\/responses\/[^/]+$/) && method === 'PUT') {
    const id = path.split('/')[4];
    return await updateAIResponse(request, env, id);
  }
  if (path.match(/^\/api\/ai\/responses\/[^/]+\/approve$/) && method === 'POST') {
    const id = path.split('/')[4];
    return await approveAIResponse(request, env, id);
  }

  // File upload endpoints
  if (path === '/api/files/upload' && method === 'POST') {
    return await uploadFile(request, env);
  }
  if (path.match(/^\/api\/files\/[^/]+$/) && method === 'GET') {
    const id = path.split('/')[3];
    return await getFile(env, id);
  }

  // Dashboard data endpoint
  if (path === '/api/dashboard/stats' && method === 'GET') {
    return await getDashboardStats(env);
  }

  return jsonResponse({ error: 'Endpoint not found' }, 404);
}

/**
 * LEAD MANAGEMENT FUNCTIONS
 */

async function createLead(request, env) {
  const data = await request.json();

  if (!data.source_url) {
    return jsonResponse({ error: 'source_url is required' }, 400);
  }

  const id = generateId('lead');
  const now = new Date().toISOString();

  const stmt = env.DB.prepare(`
    INSERT INTO leads (id, email, name, phone, company, source_url, source_platform,
                       status, priority, tags, custom_fields, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    data.email || null,
    data.name || null,
    data.phone || null,
    data.company || null,
    data.source_url,
    data.source_platform || null,
    data.status || 'new',
    data.priority || 'medium',
    data.tags ? JSON.stringify(data.tags) : null,
    data.custom_fields ? JSON.stringify(data.custom_fields) : null,
    now,
    now
  );

  await stmt.run();

  return jsonResponse({
    success: true,
    id,
    message: 'Lead created successfully'
  }, 201);
}

async function getLeads(request, env, url) {
  const status = url.searchParams.get('status');
  const priority = url.searchParams.get('priority');
  const limit = parseInt(url.searchParams.get('limit')) || 50;
  const offset = parseInt(url.searchParams.get('offset')) || 0;

  let query = 'SELECT * FROM leads WHERE 1=1';
  const bindings = [];

  if (status) {
    query += ' AND status = ?';
    bindings.push(status);
  }
  if (priority) {
    query += ' AND priority = ?';
    bindings.push(priority);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  bindings.push(limit, offset);

  const stmt = env.DB.prepare(query).bind(...bindings);
  const result = await stmt.all();

  return jsonResponse({
    success: true,
    leads: result.results.map(parseJSONFields),
    count: result.results.length
  });
}

async function getLead(env, id) {
  const stmt = env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(id);
  const result = await stmt.first();

  if (!result) {
    return jsonResponse({ error: 'Lead not found' }, 404);
  }

  return jsonResponse({
    success: true,
    lead: parseJSONFields(result)
  });
}

async function updateLead(request, env, id) {
  const data = await request.json();
  const now = new Date().toISOString();

  const updates = [];
  const bindings = [];

  const fields = ['email', 'name', 'phone', 'company', 'source_platform', 'status', 'priority'];
  fields.forEach(field => {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      bindings.push(data[field]);
    }
  });

  if (data.tags) {
    updates.push('tags = ?');
    bindings.push(JSON.stringify(data.tags));
  }
  if (data.custom_fields) {
    updates.push('custom_fields = ?');
    bindings.push(JSON.stringify(data.custom_fields));
  }

  updates.push('updated_at = ?');
  bindings.push(now);
  bindings.push(id);

  const stmt = env.DB.prepare(`
    UPDATE leads SET ${updates.join(', ')} WHERE id = ?
  `).bind(...bindings);

  await stmt.run();

  return jsonResponse({ success: true, message: 'Lead updated' });
}

/**
 * CONVERSATION MANAGEMENT FUNCTIONS
 */

async function createConversation(request, env) {
  const data = await request.json();

  if (!data.lead_id || !data.platform) {
    return jsonResponse({ error: 'lead_id and platform are required' }, 400);
  }

  const id = generateId('conv');
  const now = new Date().toISOString();

  const stmt = env.DB.prepare(`
    INSERT INTO conversations (id, lead_id, platform, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, data.lead_id, data.platform, 'active', now, now);

  await stmt.run();

  return jsonResponse({
    success: true,
    id,
    message: 'Conversation created successfully'
  }, 201);
}

async function getConversation(env, id) {
  const stmt = env.DB.prepare('SELECT * FROM conversations WHERE id = ?').bind(id);
  const result = await stmt.first();

  if (!result) {
    return jsonResponse({ error: 'Conversation not found' }, 404);
  }

  // Get messages for this conversation
  const messages = await env.DB.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
  ).bind(id).all();

  return jsonResponse({
    success: true,
    conversation: result,
    messages: messages.results.map(parseJSONFields)
  });
}

/**
 * MESSAGE MANAGEMENT FUNCTIONS
 */

async function createMessage(request, env) {
  const data = await request.json();

  if (!data.conversation_id || !data.lead_id || !data.content || !data.sender_type) {
    return jsonResponse({
      error: 'conversation_id, lead_id, content, and sender_type are required'
    }, 400);
  }

  const id = generateId('msg');
  const now = new Date().toISOString();

  // Insert message
  await env.DB.prepare(`
    INSERT INTO messages (id, conversation_id, lead_id, sender_type, sender_name,
                          content, message_type, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    data.conversation_id,
    data.lead_id,
    data.sender_type,
    data.sender_name || null,
    data.content,
    data.message_type || 'text',
    data.metadata ? JSON.stringify(data.metadata) : null,
    now
  ).run();

  // Update conversation
  await env.DB.prepare(`
    UPDATE conversations
    SET last_message_at = ?, message_count = message_count + 1, updated_at = ?
    WHERE id = ?
  `).bind(now, now, data.conversation_id).run();

  // Auto-generate AI response if this is from lead
  if (data.sender_type === 'lead' && data.auto_generate !== false) {
    ctx.waitUntil(
      generateAIResponseForMessage(env, id, data.conversation_id, data.lead_id, data.content)
    );
  }

  return jsonResponse({
    success: true,
    id,
    message: 'Message created successfully'
  }, 201);
}

async function getMessages(env, conversationId) {
  const stmt = env.DB.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
  ).bind(conversationId);
  const result = await stmt.all();

  return jsonResponse({
    success: true,
    messages: result.results.map(parseJSONFields),
    count: result.results.length
  });
}

/**
 * AI RESPONSE GENERATION FUNCTIONS
 */

async function generateAIResponse(request, env) {
  const data = await request.json();

  if (!data.conversation_id || !data.lead_id) {
    return jsonResponse({
      error: 'conversation_id and lead_id are required'
    }, 400);
  }

  // Get conversation history
  const messages = await env.DB.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
  ).bind(data.conversation_id).all();

  const lead = await env.DB.prepare(
    'SELECT * FROM leads WHERE id = ?'
  ).bind(data.lead_id).first();

  // Generate AI response using Claude API
  const aiResponse = await callClaudeAPI(env, messages.results, lead, data.context);

  // Save to database
  const id = generateId('air');
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO ai_responses (id, conversation_id, lead_id, message_id, response_text,
                              status, confidence_score, model_used, prompt_used,
                              created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    data.conversation_id,
    data.lead_id,
    data.message_id || null,
    aiResponse.text,
    'pending',
    aiResponse.confidence || null,
    aiResponse.model || 'claude-3-5-sonnet-20241022',
    aiResponse.prompt || null,
    now,
    now
  ).run();

  return jsonResponse({
    success: true,
    id,
    response: aiResponse.text,
    message: 'AI response generated successfully'
  }, 201);
}

async function generateAIResponseForMessage(env, messageId, conversationId, leadId, content) {
  try {
    const messages = await env.DB.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    ).bind(conversationId).all();

    const lead = await env.DB.prepare(
      'SELECT * FROM leads WHERE id = ?'
    ).bind(leadId).first();

    const aiResponse = await callClaudeAPI(env, messages.results, lead);

    const id = generateId('air');
    const now = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO ai_responses (id, conversation_id, lead_id, message_id, response_text,
                                status, confidence_score, model_used, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      conversationId,
      leadId,
      messageId,
      aiResponse.text,
      'pending',
      aiResponse.confidence || null,
      aiResponse.model || 'claude-3-5-sonnet-20241022',
      now,
      now
    ).run();

  } catch (error) {
    console.error('Error generating AI response:', error);
  }
}

async function callClaudeAPI(env, messages, lead, additionalContext) {
  if (!env.ANTHROPIC_API_KEY) {
    return {
      text: '[AI Response] Thank you for your message. We\'ll get back to you soon!',
      model: 'fallback',
      confidence: 0.5
    };
  }

  const conversationHistory = messages.map(msg => ({
    role: msg.sender_type === 'lead' ? 'user' : 'assistant',
    content: msg.content
  }));

  const systemPrompt = `You are a helpful sales assistant responding to a lead inquiry.
Lead information: ${JSON.stringify(lead)}
${additionalContext ? `Additional context: ${additionalContext}` : ''}

Respond professionally and helpfully. Keep responses concise and actionable.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        system: systemPrompt,
        messages: conversationHistory
      })
    });

    const data = await response.json();

    return {
      text: data.content[0].text,
      model: data.model,
      confidence: 0.9
    };
  } catch (error) {
    console.error('Claude API error:', error);
    return {
      text: '[AI Response] Thank you for reaching out. A team member will respond shortly.',
      model: 'fallback',
      confidence: 0.5
    };
  }
}

async function getAIResponses(env, url) {
  const status = url.searchParams.get('status') || 'pending';
  const limit = parseInt(url.searchParams.get('limit')) || 50;

  const stmt = env.DB.prepare(`
    SELECT r.*, l.name as lead_name, l.email as lead_email,
           c.platform as conversation_platform
    FROM ai_responses r
    JOIN leads l ON r.lead_id = l.id
    JOIN conversations c ON r.conversation_id = c.id
    WHERE r.status = ?
    ORDER BY r.created_at DESC
    LIMIT ?
  `).bind(status, limit);

  const result = await stmt.all();

  return jsonResponse({
    success: true,
    responses: result.results.map(parseJSONFields),
    count: result.results.length
  });
}

async function updateAIResponse(request, env, id) {
  const data = await request.json();
  const now = new Date().toISOString();

  await env.DB.prepare(`
    UPDATE ai_responses
    SET edited_text = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).bind(data.edited_text || null, data.status || 'pending', now, id).run();

  return jsonResponse({ success: true, message: 'AI response updated' });
}

async function approveAIResponse(request, env, id) {
  const data = await request.json();
  const now = new Date().toISOString();

  // Update response status
  await env.DB.prepare(`
    UPDATE ai_responses
    SET status = 'approved', reviewed_by = ?, reviewed_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(data.reviewed_by || 'system', now, now, id).run();

  // Get the response
  const response = await env.DB.prepare(
    'SELECT * FROM ai_responses WHERE id = ?'
  ).bind(id).first();

  // Optionally create a message with the approved response
  if (data.send_immediately) {
    const msgId = generateId('msg');
    await env.DB.prepare(`
      INSERT INTO messages (id, conversation_id, lead_id, sender_type, content,
                            message_type, created_at)
      VALUES (?, ?, ?, 'agent', ?, 'text', ?)
    `).bind(
      msgId,
      response.conversation_id,
      response.lead_id,
      response.edited_text || response.response_text,
      now
    ).run();

    // Update AI response as sent
    await env.DB.prepare(`
      UPDATE ai_responses SET status = 'sent', sent_at = ? WHERE id = ?
    `).bind(now, id).run();
  }

  return jsonResponse({
    success: true,
    message: 'AI response approved',
    sent: data.send_immediately || false
  });
}

/**
 * FILE STORAGE FUNCTIONS (R2)
 */

async function uploadFile(request, env) {
  if (!env.R2_BUCKET) {
    return jsonResponse({ error: 'R2 bucket not configured' }, 503);
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const leadId = formData.get('lead_id');
  const conversationId = formData.get('conversation_id');
  const messageId = formData.get('message_id');

  if (!file) {
    return jsonResponse({ error: 'No file provided' }, 400);
  }

  const id = generateId('file');
  const fileKey = `${id}_${file.name}`;

  // Upload to R2
  await env.R2_BUCKET.put(fileKey, file.stream(), {
    httpMetadata: {
      contentType: file.type
    }
  });

  // Save metadata to D1
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO files (id, lead_id, conversation_id, message_id, filename,
                       file_type, file_size, r2_key, r2_bucket, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    leadId || null,
    conversationId || null,
    messageId || null,
    file.name,
    file.type,
    file.size,
    fileKey,
    env.R2_BUCKET_NAME || 'default',
    now
  ).run();

  return jsonResponse({
    success: true,
    id,
    filename: file.name,
    message: 'File uploaded successfully'
  }, 201);
}

async function getFile(env, id) {
  const file = await env.DB.prepare(
    'SELECT * FROM files WHERE id = ?'
  ).bind(id).first();

  if (!file) {
    return jsonResponse({ error: 'File not found' }, 404);
  }

  if (!env.R2_BUCKET) {
    return jsonResponse({ error: 'R2 bucket not configured' }, 503);
  }

  const object = await env.R2_BUCKET.get(file.r2_key);

  if (!object) {
    return jsonResponse({ error: 'File not found in storage' }, 404);
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': file.file_type,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      ...corsHeaders()
    }
  });
}

/**
 * DASHBOARD FUNCTIONS
 */

async function getDashboardStats(env) {
  const totalLeads = await env.DB.prepare('SELECT COUNT(*) as count FROM leads').first();
  const pendingResponses = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM ai_responses WHERE status = ?'
  ).bind('pending').first();
  const activeConversations = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM conversations WHERE status = ?'
  ).bind('active').first();

  const recentLeads = await env.DB.prepare(
    'SELECT * FROM leads ORDER BY created_at DESC LIMIT 10'
  ).all();

  return jsonResponse({
    success: true,
    stats: {
      total_leads: totalLeads.count,
      pending_responses: pendingResponses.count,
      active_conversations: activeConversations.count
    },
    recent_leads: recentLeads.results.map(parseJSONFields)
  });
}

function getDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lead Management Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f7fa;
      color: #333;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    .header p { opacity: 0.9; }
    .container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: white;
      padding: 1.5rem;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .stat-card h3 { color: #666; font-size: 0.875rem; margin-bottom: 0.5rem; }
    .stat-card .value { font-size: 2.5rem; font-weight: bold; color: #667eea; }
    .section {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      margin-bottom: 2rem;
    }
    .section h2 { margin-bottom: 1.5rem; color: #333; }
    .response-item {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1rem;
      transition: all 0.2s;
    }
    .response-item:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .response-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .lead-name { font-weight: 600; color: #333; }
    .timestamp { font-size: 0.875rem; color: #999; }
    .response-text {
      padding: 1rem;
      background: #f9f9f9;
      border-radius: 6px;
      margin: 1rem 0;
      line-height: 1.6;
    }
    .actions {
      display: flex;
      gap: 0.5rem;
    }
    button {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s;
    }
    .btn-approve {
      background: #4CAF50;
      color: white;
    }
    .btn-approve:hover { background: #45a049; }
    .btn-edit {
      background: #2196F3;
      color: white;
    }
    .btn-edit:hover { background: #1976D2; }
    .btn-reject {
      background: #f44336;
      color: white;
    }
    .btn-reject:hover { background: #da190b; }
    .empty-state {
      text-align: center;
      padding: 3rem;
      color: #999;
    }
    .loading {
      text-align: center;
      padding: 2rem;
    }
    .spinner {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #667eea;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    textarea {
      width: 100%;
      min-height: 100px;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-family: inherit;
      font-size: 0.875rem;
      resize: vertical;
    }
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal.active { display: flex; }
    .modal-content {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .modal-header h3 { font-size: 1.5rem; }
    .close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Lead Management Dashboard</h1>
    <p>AI-powered lead response system</p>
  </div>

  <div class="container">
    <div class="stats">
      <div class="stat-card">
        <h3>Total Leads</h3>
        <div class="value" id="totalLeads">-</div>
      </div>
      <div class="stat-card">
        <h3>Pending AI Responses</h3>
        <div class="value" id="pendingResponses">-</div>
      </div>
      <div class="stat-card">
        <h3>Active Conversations</h3>
        <div class="value" id="activeConversations">-</div>
      </div>
    </div>

    <div class="section">
      <h2>Pending AI Responses</h2>
      <div id="responsesList">
        <div class="loading">
          <div class="spinner"></div>
          <p style="margin-top: 1rem;">Loading responses...</p>
        </div>
      </div>
    </div>
  </div>

  <div class="modal" id="editModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Edit AI Response</h3>
        <button class="close-btn" onclick="closeEditModal()">&times;</button>
      </div>
      <textarea id="editTextarea"></textarea>
      <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
        <button class="btn-approve" onclick="saveEditedResponse()">Save & Approve</button>
        <button class="btn-edit" onclick="saveEditedResponse(false)">Save Draft</button>
        <button onclick="closeEditModal()" style="background: #999; color: white;">Cancel</button>
      </div>
    </div>
  </div>

  <script>
    let currentEditId = null;

    async function loadDashboard() {
      try {
        const response = await fetch('/api/dashboard/stats');
        const data = await response.json();

        if (data.success) {
          document.getElementById('totalLeads').textContent = data.stats.total_leads;
          document.getElementById('pendingResponses').textContent = data.stats.pending_responses;
          document.getElementById('activeConversations').textContent = data.stats.active_conversations;
        }

        await loadPendingResponses();
      } catch (error) {
        console.error('Error loading dashboard:', error);
      }
    }

    async function loadPendingResponses() {
      try {
        const response = await fetch('/api/ai/responses?status=pending');
        const data = await response.json();

        const container = document.getElementById('responsesList');

        if (!data.success || data.responses.length === 0) {
          container.innerHTML = '<div class="empty-state">No pending responses. All caught up!</div>';
          return;
        }

        container.innerHTML = data.responses.map(r => \`
          <div class="response-item">
            <div class="response-header">
              <div>
                <div class="lead-name">\${r.lead_name || 'Unknown Lead'}</div>
                <div class="timestamp">\${r.lead_email || ''} • \${new Date(r.created_at).toLocaleString()}</div>
              </div>
            </div>
            <div class="response-text">\${r.response_text}</div>
            <div class="actions">
              <button class="btn-approve" onclick="approveResponse('\${r.id}', true)">Approve & Send</button>
              <button class="btn-edit" onclick="editResponse('\${r.id}', \\\`\${r.response_text.replace(/\`/g, '\\\\`')}\\\`)">Edit</button>
              <button class="btn-reject" onclick="rejectResponse('\${r.id}')">Reject</button>
            </div>
          </div>
        \`).join('');

      } catch (error) {
        console.error('Error loading responses:', error);
        document.getElementById('responsesList').innerHTML =
          '<div class="empty-state">Error loading responses. Please refresh.</div>';
      }
    }

    async function approveResponse(id, sendImmediately = false) {
      try {
        const response = await fetch(\`/api/ai/responses/\${id}/approve\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reviewed_by: 'user',
            send_immediately: sendImmediately
          })
        });

        if (response.ok) {
          alert(sendImmediately ? 'Response approved and sent!' : 'Response approved!');
          loadPendingResponses();
        }
      } catch (error) {
        console.error('Error approving response:', error);
        alert('Error approving response');
      }
    }

    function editResponse(id, text) {
      currentEditId = id;
      document.getElementById('editTextarea').value = text;
      document.getElementById('editModal').classList.add('active');
    }

    function closeEditModal() {
      document.getElementById('editModal').classList.remove('active');
      currentEditId = null;
    }

    async function saveEditedResponse(approve = true) {
      const editedText = document.getElementById('editTextarea').value;

      try {
        await fetch(\`/api/ai/responses/\${currentEditId}\`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            edited_text: editedText,
            status: approve ? 'approved' : 'pending'
          })
        });

        if (approve) {
          await approveResponse(currentEditId, true);
        }

        closeEditModal();
        loadPendingResponses();
      } catch (error) {
        console.error('Error saving response:', error);
        alert('Error saving response');
      }
    }

    async function rejectResponse(id) {
      if (!confirm('Are you sure you want to reject this response?')) return;

      try {
        await fetch(\`/api/ai/responses/\${id}\`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'rejected' })
        });

        loadPendingResponses();
      } catch (error) {
        console.error('Error rejecting response:', error);
        alert('Error rejecting response');
      }
    }

    // Load dashboard on page load
    loadDashboard();

    // Auto-refresh every 30 seconds
    setInterval(loadPendingResponses, 30000);
  </script>
</body>
</html>`;
}

/**
 * UTILITY FUNCTIONS
 */

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function parseJSONFields(row) {
  const parsed = { ...row };
  ['tags', 'custom_fields', 'metadata'].forEach(field => {
    if (parsed[field]) {
      try {
        parsed[field] = JSON.parse(parsed[field]);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }
  });
  return parsed;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function corsResponse() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}

function serveHTML(html, title) {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      ...corsHeaders()
    }
  });
}
