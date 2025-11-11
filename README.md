# TheBash.com Content Reader - Chrome Extension

A Chrome extension that reads and extracts content from thebash.com, allowing you to view and copy bash quotes directly from your browser.

## Features

- Automatically extracts bash quotes from thebash.com pages
- Clean, user-friendly popup interface
- Copy all quotes to clipboard with one click
- Stores the latest extracted content for quick access
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

## Files Structure

```
contentcreator/
├── manifest.json       # Extension configuration
├── content.js          # Content script that runs on thebash.com
├── popup.html          # Extension popup UI
├── popup.js            # Popup functionality
├── icons/              # Extension icons (16x16, 48x48, 128x128)
└── README.md           # This file
```

## How It Works

1. **Content Script** (`content.js`): Runs on thebash.com pages and extracts quotes from the page DOM
2. **Popup Interface** (`popup.html` + `popup.js`): Provides a user interface to trigger extraction and view results
3. **Storage**: Uses Chrome's storage API to cache the latest extracted content

## Permissions

- `activeTab`: To read content from the current thebash.com tab
- `storage`: To cache extracted content locally
- `host_permissions`: Limited to thebash.com domains only

## Development

To modify the extension:

1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card to reload it
4. Test your changes on thebash.com

## Notes

- This extension only works on thebash.com domains
- Content is extracted from the page's DOM structure
- If the site structure changes, the selectors in content.js may need updating

## License

MIT License
