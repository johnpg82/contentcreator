# TheBash.com Content Reader - Chrome Extension

A Chrome extension that reads and extracts content from thebash.com, allowing you to view and copy bash quotes directly from your browser.

## Features

- Automatically extracts bash quotes from thebash.com pages
- Clean, user-friendly popup interface
- Copy all quotes to clipboard with one click
- Stores the latest extracted content for quick access
- **Save content to Cloudflare Worker for persistent storage**
- **Auto-save functionality** - automatically save content when visiting thebash.com
- **Configurable settings** - customize Worker endpoint and behavior
- Works on any thebash.com page

## Installation

### Load Unpacked Extension (Development Mode)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" by toggling the switch in the top-right corner
3. Click "Load unpacked" button
4. Select the folder containing this extension (the folder with manifest.json)
5. The extension should now appear in your extensions list

### Using the Extension

1. Navigate to any page on thebash.com
2. Click the extension icon in your browser toolbar
3. Click "Extract Content" to read and display quotes from the current page
4. Use "Copy All" to copy all extracted quotes to your clipboard
5. **Optional**: Click "Save to Worker" to save content to your Cloudflare Worker
6. **Configure**: Click "Configure Worker Endpoint" to set up your Worker URL and preferences

## Files Structure

```
contentcreator/
├── manifest.json       # Extension configuration
├── content.js          # Content script that runs on thebash.com
├── popup.html          # Extension popup UI
├── popup.js            # Popup functionality
├── options.html        # Settings/configuration page
├── options.js          # Settings page functionality
├── icons/              # Extension icons (16x16, 48x48, 128x128)
├── worker/             # Cloudflare Worker for persistent storage
│   ├── index.js        # Worker code
│   ├── schema.sql      # D1 database schema
│   ├── wrangler.toml   # Worker configuration
│   ├── package.json    # Dependencies and scripts
│   └── README.md       # Worker setup instructions
└── README.md           # This file
```

## How It Works

1. **Content Script** (`content.js`): Runs on thebash.com pages and extracts quotes from the page DOM
2. **Popup Interface** (`popup.html` + `popup.js`): Provides a user interface to trigger extraction and view results
3. **Local Storage**: Uses Chrome's storage API to cache the latest extracted content
4. **Cloudflare Worker** (optional): Saves content to a persistent cloud database for long-term storage and retrieval

## Permissions

- `activeTab`: To read content from the current thebash.com tab
- `storage`: To cache extracted content locally
- `host_permissions`: Limited to thebash.com domains only

## Cloudflare Worker Setup (Optional)

The extension can save content to a Cloudflare Worker for persistent storage. This is completely optional - the extension works without it.

### Quick Setup

1. Navigate to the `worker/` directory
2. Follow the instructions in `worker/README.md` to:
   - Install dependencies (`npm install`)
   - Create a D1 database or KV namespace
   - Deploy the worker (`npm run deploy`)
3. Copy your worker URL (e.g., `https://thebash-content-storage.your-subdomain.workers.dev`)
4. In the Chrome extension, click "Configure Worker Endpoint" and paste your URL
5. Enable auto-save if desired

For detailed instructions, see [worker/README.md](worker/README.md).

## Development

To modify the extension:

1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card to reload it
4. Test your changes on thebash.com

To develop the Cloudflare Worker locally:

1. `cd worker`
2. `npm run dev`
3. Test at `http://localhost:8787`

## Notes

- This extension only works on thebash.com domains
- Content is extracted from the page's DOM structure
- If the site structure changes, the selectors in content.js may need updating

## License

MIT License
