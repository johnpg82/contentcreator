# Extension Icons

This folder should contain the extension icons in PNG format:

- `icon16.png` - 16x16 pixels (toolbar icon)
- `icon48.png` - 48x48 pixels (extension management page)
- `icon128.png` - 128x128 pixels (Chrome Web Store)

## How to Create Icons

You can create icons using any image editor. The icons should represent the extension's purpose (reading content from thebash.com).

### Using Online Tools

1. Visit a free icon generator like:
   - https://www.favicon-generator.org/
   - https://realfavicongenerator.net/
   - https://www.canva.com/

2. Create or upload an image
3. Export in the required sizes

### Using ImageMagick (if installed)

```bash
# Create a simple placeholder (replace with your image)
convert -size 128x128 xc:#4CAF50 -pointsize 72 -fill white -gravity center -annotate +0+0 "B" icon128.png
convert icon128.png -resize 48x48 icon48.png
convert icon128.png -resize 16x16 icon16.png
```

### Temporary Workaround

The extension will work without custom icons - Chrome will display a default icon. You can add custom icons later.
