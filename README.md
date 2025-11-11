# Lead Management Assistant

An AI-powered lead management system built with Chrome Extension, Cloudflare Workers, D1 Database, and R2 Storage. Automatically captures lead chats, generates AI responses, and provides a review dashboard.

## Features

### 🤖 AI-Powered Response Generation
- Automatic AI response generation using Claude API
- Review and edit AI responses before sending
- Confidence scoring for generated responses
- Context-aware conversation handling

### 💬 Chat Capture
- Automatic chat message capture from any website
- Support for popular chat platforms (Intercom, Drift, HubSpot, Zendesk, etc.)
- Manual and automatic capture modes
- Real-time message detection

### 📊 Lead Management
- Complete lead database with custom fields
- Conversation threading and history
- Lead status tracking (new, contacted, qualified, converted, lost)
- Priority management (low, medium, high, urgent)
- Tags and custom fields support

### 📁 File Storage
- R2-powered file storage for attachments
- Automatic file metadata tracking
- Secure file upload and retrieval

### 🎯 Review Dashboard
- Web-based UI for reviewing AI responses
- Real-time statistics and metrics
- Approve, edit, or reject responses
- Send approved responses instantly

## Architecture

```
┌─────────────────┐
│ Chrome Extension │  ← Captures chats from websites
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Cloudflare      │  ← Processes requests, generates AI responses
│ Worker          │
└────────┬────────┘
         │
    ┌────┴────┐
    ↓         ↓
┌─────────┐ ┌─────────┐
│ D1      │ │ R2      │
│ Database│ │ Storage │
└─────────┘ └─────────┘
```

## Installation

### 1. Deploy Cloudflare Worker

```bash
cd worker
npm install

# Login to Cloudflare
wrangler login

# Create D1 database
npm run db:create
# Copy the database ID and update wrangler.toml

# Initialize database schema
npm run db:init

# Create R2 bucket
npm run r2:create

# Set Anthropic API key (for AI responses)
npm run secret:set
# Enter your Anthropic API key when prompted

# Deploy worker
npm run deploy
```

Your worker will be available at: `https://lead-management-system.your-subdomain.workers.dev`

### 2. Install Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `contentcreator` directory
5. The extension should appear in your extensions list

### 3. Configure Extension

1. Click the extension icon in your toolbar
2. Click "Configure Worker Endpoint"
3. Enter your Cloudflare Worker URL
4. Configure auto-capture settings as desired
5. Save settings

## Usage

### Capturing Lead Chats

**Automatic Mode:**
1. Enable "Auto-capture" in extension settings
2. Visit any website with a chat widget
3. Extension automatically captures lead messages
4. AI responses are generated automatically

**Manual Mode:**
1. Navigate to a page with chat messages
2. Click the extension icon
3. Click "Capture Chats" button
4. Review captured messages

### Reviewing AI Responses

1. Navigate to your worker URL: `https://your-worker-url.workers.dev/dashboard`
2. View pending AI responses
3. For each response:
   - **Approve & Send** - Send immediately
   - **Edit** - Modify the response before approving
   - **Reject** - Discard the response

### Managing Leads

Access the API endpoints directly or build a custom frontend:

```javascript
// Get all leads
GET /api/leads

// Get specific lead
GET /api/leads/{id}

// Update lead status
PUT /api/leads/{id}
{
  "status": "qualified",
  "priority": "high"
}

// Get conversation with messages
GET /api/conversations/{id}

// Get pending AI responses
GET /api/ai/responses?status=pending
```

## API Reference

### Leads

- `POST /api/leads` - Create new lead
- `GET /api/leads` - List leads (with filters)
- `GET /api/leads/{id}` - Get specific lead
- `PUT /api/leads/{id}` - Update lead

### Conversations

- `POST /api/conversations` - Create conversation
- `GET /api/conversations/{id}` - Get conversation with messages

### Messages

- `POST /api/messages` - Add message to conversation
- `GET /api/conversations/{id}/messages` - Get all messages

### AI Responses

- `POST /api/ai/generate` - Generate AI response
- `GET /api/ai/responses` - List AI responses
- `PUT /api/ai/responses/{id}` - Update AI response
- `POST /api/ai/responses/{id}/approve` - Approve and optionally send

### Files

- `POST /api/files/upload` - Upload file to R2
- `GET /api/files/{id}` - Download file

### Dashboard

- `GET /` or `/dashboard` - Review dashboard UI
- `GET /api/dashboard/stats` - Get dashboard statistics

## Database Schema

### Leads
- Lead information (name, email, phone, company)
- Source tracking (URL, platform)
- Status and priority management
- Custom fields and tags

### Conversations
- Conversation threading
- Platform tracking
- Status management
- Message count tracking

### Messages
- Individual chat messages
- Sender type (lead, agent, system)
- Message type (text, image, file)
- Metadata support

### AI Responses
- Generated response text
- Status tracking (pending, approved, rejected, sent)
- Confidence scoring
- Edit history
- Model information

### Files
- File metadata
- R2 storage references
- Association with leads/conversations/messages

## Configuration

### Environment Variables

Set in `wrangler.toml`:

```toml
[vars]
R2_BUCKET_NAME = "lead-files"
ENVIRONMENT = "production"
```

### Secrets

Set via Wrangler CLI:

```bash
wrangler secret put ANTHROPIC_API_KEY
```

### Extension Settings

- **Worker URL**: Your deployed Cloudflare Worker URL
- **Auto-capture**: Enable/disable automatic chat capture
- **Notifications**: Show notifications for new leads
- **Capture Mode**: Manual or automatic

## Development

### Local Development

```bash
# Start worker locally
cd worker
npm run dev

# Visit http://localhost:8787/dashboard

# Initialize local database
npm run db:init:local
```

### Modifying the Extension

1. Make changes to extension files
2. Go to `chrome://extensions/`
3. Click reload icon on the extension card
4. Test your changes

### Testing

```bash
# Test worker endpoint
curl http://localhost:8787/api/dashboard/stats

# Test AI response generation
curl -X POST http://localhost:8787/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"conversation_id":"conv_123","lead_id":"lead_123"}'
```

## Troubleshooting

### Extension not capturing chats
- Check if auto-capture is enabled in settings
- Open browser console to see detection logs
- Try manual capture mode
- Verify the chat widget is using standard DOM elements

### AI responses not generating
- Verify ANTHROPIC_API_KEY is set correctly
- Check worker logs: `npm run tail`
- Ensure D1 database is properly initialized
- Verify API quota limits

### Dashboard not loading
- Check worker deployment status
- Verify D1 database is accessible
- Check browser console for errors
- Ensure worker URL is correct

### Database errors
- Re-run database initialization: `npm run db:init`
- Check D1 binding in wrangler.toml
- Verify database ID matches

## Security Considerations

- Extension only runs on pages with chat widgets
- All data is stored in your Cloudflare account
- API keys stored as Cloudflare secrets
- CORS configured for extension access only
- No third-party data sharing

## Roadmap

- [ ] Multi-language support for AI responses
- [ ] Advanced lead scoring
- [ ] Email integration
- [ ] Slack/Teams notifications
- [ ] Custom AI response templates
- [ ] Bulk operations on leads
- [ ] Analytics and reporting dashboard
- [ ] Mobile app for lead management

## License

MIT License

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Cloudflare Workers documentation
3. Check browser console for errors
4. Ensure all dependencies are installed

## Credits

Built with:
- Cloudflare Workers & Pages
- Cloudflare D1 Database
- Cloudflare R2 Storage
- Anthropic Claude API
- Chrome Extensions API
