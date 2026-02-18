#!/bin/bash

# Generate PNG favicons from SVG
# This script requires ImageMagick (install with: brew install imagemagick)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SVG_FILE="$SCRIPT_DIR/public/favicon.svg"
PUBLIC_DIR="$SCRIPT_DIR/public"

if ! command -v convert &> /dev/null; then
    echo "ImageMagick is not installed. Install it with: brew install imagemagick"
    exit 1
fi

echo "Generating PNG favicons from SVG..."

# Generate different sizes
convert -background none "$SVG_FILE" -resize 16x16 "$PUBLIC_DIR/favicon-16x16.png"
convert -background none "$SVG_FILE" -resize 32x32 "$PUBLIC_DIR/favicon-32x32.png"
convert -background none "$SVG_FILE" -resize 180x180 "$PUBLIC_DIR/apple-touch-icon.png"
convert -background none "$SVG_FILE" -resize 192x192 "$PUBLIC_DIR/android-chrome-192x192.png"
convert -background none "$SVG_FILE" -resize 512x512 "$PUBLIC_DIR/android-chrome-512x512.png"

echo "✅ Favicons generated successfully!"
echo "   - favicon-16x16.png"
echo "   - favicon-32x32.png"
echo "   - apple-touch-icon.png"
echo "   - android-chrome-192x192.png"
echo "   - android-chrome-512x512.png"
