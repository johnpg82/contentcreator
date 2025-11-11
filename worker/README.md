# Cloudflare Worker - TheBash.com Content Storage

A Cloudflare Worker that provides an API endpoint for storing and retrieving content extracted from thebash.com by the Chrome extension.

## Features

- RESTful API for saving and retrieving content
- Supports both D1 Database and KV storage
- CORS enabled for browser extensions
- Automatic ID generation and timestamping
- List and retrieve saved content

## API Endpoints

### POST /api/save
Save extracted content from thebash.com

**Request Body:**
```json
{
  "url": "https://thebash.com/...",
  "pageTitle": "Page Title",
  "quotes": [
    {
      "id": 1,
      "text": "Quote text here",
      "html": "<p>Quote HTML here</p>"
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Content saved successfully",
  "id": "bash_1234567890_abc123",
  "quotesCount": 5,
  "savedAt": "2024-01-01T00:00:00.000Z"
}
```

### GET /api/list?limit=50
List all saved content (most recent first)

**Response:**
```json
{
  "success": true,
  "count": 10,
  "items": [
    {
      "id": "bash_1234567890_abc123",
      "url": "https://thebash.com/...",
      "page_title": "Page Title",
      "quotes_count": 5,
      "saved_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### GET /api/get?id=bash_1234567890_abc123
Get specific content by ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "bash_1234567890_abc123",
    "url": "https://thebash.com/...",
    "pageTitle": "Page Title",
    "quotes": [...],
    "savedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## Setup and Deployment

### Prerequisites

- Node.js (v16 or later)
- Cloudflare account
- Wrangler CLI installed globally: `npm install -g wrangler`

### Installation

1. Navigate to the worker directory:
```bash
cd worker
npm install
```

2. Login to Cloudflare:
```bash
wrangler login
```

### Storage Options

You can use either D1 Database (recommended) or KV storage:

#### Option 1: D1 Database (Recommended)

1. Create a D1 database:
```bash
npm run db:create
```

2. Note the database ID from the output and update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "thebash-content"
database_id = "your-database-id-here"  # Use the ID from step 1
```

3. Initialize the database schema:
```bash
npm run db:init
```

#### Option 2: KV Storage

1. Create a KV namespace:
```bash
wrangler kv:namespace create CONTENT_STORE
```

2. Update `wrangler.toml` with the KV namespace ID:
```toml
[[kv_namespaces]]
binding = "CONTENT_STORE"
id = "your-kv-namespace-id-here"
```

### Local Development

1. For local development with D1:
```bash
npm run db:init:local
npm run dev
```

2. Test the endpoint:
```bash
curl http://localhost:8787/
```

### Deployment

1. Deploy to Cloudflare:
```bash
npm run deploy
```

2. Your worker will be available at:
```
https://thebash-content-storage.your-subdomain.workers.dev
```

3. Update the Chrome extension with your worker URL (see extension README)

### Monitoring

View live logs:
```bash
npm run tail
```

## Security Considerations

- CORS is currently set to `*` (allow all origins) for development
- For production, update the `corsHeaders()` function to restrict to your extension ID
- Consider adding authentication if storing sensitive data
- Rate limiting is handled by Cloudflare's free tier limits

## Storage Limits

**D1 Database (Free Tier):**
- 5 GB storage
- 5 million rows read per day
- 100,000 rows written per day

**KV Storage (Free Tier):**
- 1 GB storage
- 100,000 read operations per day
- 1,000 write operations per day

## Troubleshooting

### Database not found
Make sure you've run `npm run db:init` after creating the database.

### CORS errors
Check that your worker URL is correctly configured in the extension and that CORS headers are properly set.

### Worker not updating
After deployment, wait a few seconds for the changes to propagate. Clear your browser cache if needed.

## License

MIT
