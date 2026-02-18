const fs = require("fs");
const path = require("path");

// Simple PNG generation from SVG using sharp
async function generateFavicons() {
  try {
    const sharp = require("sharp");
    const svgPath = path.join(__dirname, "public", "favicon.svg");
    const publicDir = path.join(__dirname, "public");

    const sizes = [
      { name: "favicon-16x16.png", size: 16 },
      { name: "favicon-32x32.png", size: 32 },
      { name: "apple-touch-icon.png", size: 180 },
      { name: "android-chrome-192x192.png", size: 192 },
      { name: "android-chrome-512x512.png", size: 512 },
    ];

    for (const { name, size } of sizes) {
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(path.join(publicDir, name));
      console.log(`✓ Generated ${name}`);
    }

    console.log("\n✅ All favicons generated successfully!");
  } catch (error) {
    console.error("Error generating favicons:", error.message);
    console.log("\nℹ️  Install sharp with: npm install sharp");
  }
}

generateFavicons();
