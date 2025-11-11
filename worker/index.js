/**
 * Cloudflare Worker for storing thebash.com content
 *
 * This worker accepts POST requests with extracted content from the Chrome extension
 * and stores it in Cloudflare D1 database or KV storage.
 */

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    const url = new URL(request.url);

    // Route handling
    if (url.pathname === '/api/save' && request.method === 'POST') {
      return await handleSave(request, env);
    }

    if (url.pathname === '/api/list' && request.method === 'GET') {
      return await handleList(request, env);
    }

    if (url.pathname === '/api/get' && request.method === 'GET') {
      return await handleGet(request, env);
    }

    if (url.pathname === '/' || url.pathname === '') {
      return new Response(JSON.stringify({
        service: 'TheBash.com Content Storage API',
        version: '1.0.0',
        endpoints: {
          'POST /api/save': 'Save extracted content',
          'GET /api/list': 'List all saved content (optional: ?limit=10)',
          'GET /api/get?id=xxx': 'Get specific content by ID'
        }
      }), {
        status: 200,
        headers: corsHeaders()
      });
    }

    return new Response('Not Found', {
      status: 404,
      headers: corsHeaders()
    });
  }
};

/**
 * Handle saving content
 */
async function handleSave(request, env) {
  try {
    const data = await request.json();

    // Validate required fields
    if (!data.quotes || !Array.isArray(data.quotes)) {
      return jsonResponse({
        success: false,
        error: 'Invalid data format: quotes array is required'
      }, 400);
    }

    // Generate a unique ID
    const id = generateId();
    const timestamp = new Date().toISOString();

    const record = {
      id,
      url: data.url || 'unknown',
      pageTitle: data.pageTitle || 'Untitled',
      quotesCount: data.quotes.length,
      quotes: data.quotes,
      extractedAt: data.timestamp || timestamp,
      savedAt: timestamp
    };

    // Store in D1 if available, otherwise use KV
    if (env.DB) {
      await saveToD1(env.DB, record);
    } else if (env.CONTENT_STORE) {
      await saveToKV(env.CONTENT_STORE, record);
    } else {
      // No storage configured - just return success with the data
      console.log('No storage configured. Data:', JSON.stringify(record));
      return jsonResponse({
        success: true,
        message: 'Content received (storage not configured)',
        id,
        quotesCount: record.quotesCount
      });
    }

    return jsonResponse({
      success: true,
      message: 'Content saved successfully',
      id,
      quotesCount: record.quotesCount,
      savedAt: timestamp
    });

  } catch (error) {
    console.error('Error saving content:', error);
    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

/**
 * Handle listing all content
 */
async function handleList(request, env) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 50;

    let results;

    if (env.DB) {
      results = await listFromD1(env.DB, limit);
    } else if (env.CONTENT_STORE) {
      results = await listFromKV(env.CONTENT_STORE, limit);
    } else {
      return jsonResponse({
        success: false,
        error: 'No storage configured'
      }, 503);
    }

    return jsonResponse({
      success: true,
      count: results.length,
      items: results
    });

  } catch (error) {
    console.error('Error listing content:', error);
    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

/**
 * Handle getting specific content by ID
 */
async function handleGet(request, env) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return jsonResponse({
        success: false,
        error: 'ID parameter is required'
      }, 400);
    }

    let result;

    if (env.DB) {
      result = await getFromD1(env.DB, id);
    } else if (env.CONTENT_STORE) {
      result = await getFromKV(env.CONTENT_STORE, id);
    } else {
      return jsonResponse({
        success: false,
        error: 'No storage configured'
      }, 503);
    }

    if (!result) {
      return jsonResponse({
        success: false,
        error: 'Content not found'
      }, 404);
    }

    return jsonResponse({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error getting content:', error);
    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

/**
 * D1 Database functions
 */
async function saveToD1(db, record) {
  await db.prepare(`
    INSERT INTO content (id, url, page_title, quotes_count, quotes, extracted_at, saved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.url,
    record.pageTitle,
    record.quotesCount,
    JSON.stringify(record.quotes),
    record.extractedAt,
    record.savedAt
  ).run();
}

async function listFromD1(db, limit) {
  const result = await db.prepare(`
    SELECT id, url, page_title, quotes_count, extracted_at, saved_at
    FROM content
    ORDER BY saved_at DESC
    LIMIT ?
  `).bind(limit).all();

  return result.results || [];
}

async function getFromD1(db, id) {
  const result = await db.prepare(`
    SELECT * FROM content WHERE id = ?
  `).bind(id).first();

  if (result && result.quotes) {
    result.quotes = JSON.parse(result.quotes);
  }

  return result;
}

/**
 * KV Storage functions
 */
async function saveToKV(kv, record) {
  // Save the full record
  await kv.put(`content:${record.id}`, JSON.stringify(record));

  // Add to index for listing (store as metadata)
  const indexKey = `index:${record.savedAt}:${record.id}`;
  await kv.put(indexKey, record.id, {
    metadata: {
      url: record.url,
      quotesCount: record.quotesCount,
      savedAt: record.savedAt
    }
  });
}

async function listFromKV(kv, limit) {
  const list = await kv.list({ prefix: 'index:', limit });

  return list.keys.map(key => ({
    id: key.name.split(':')[2],
    ...key.metadata
  }));
}

async function getFromKV(kv, id) {
  const data = await kv.get(`content:${id}`, 'json');
  return data;
}

/**
 * Utility functions
 */
function generateId() {
  return `bash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders()
  });
}
