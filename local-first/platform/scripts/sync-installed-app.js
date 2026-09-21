const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../apps/desktop/dist-installers-v6/win-unpacked/resources');
const destDir = path.join(process.env.LOCALAPPDATA || '', 'Programs', '@cafeosdesktop', 'resources');

console.log('Syncing desktop release resources to installed directory...');
console.log('Source:', srcDir);
console.log('Destination:', destDir);

// Source bundle web-server
const bundleWebServer = path.resolve(__dirname, '../apps/desktop/bundle/web-server');
const unpackedResources = path.resolve(__dirname, '../apps/desktop/dist-installers-v6/win-unpacked/resources');
const unpackedWebServer = path.join(unpackedResources, 'web-server');

if (fs.existsSync(bundleWebServer)) {
  if (fs.existsSync(unpackedResources)) {
    console.log('Syncing bundle/web-server -> win-unpacked/resources/web-server...');
    fs.cpSync(bundleWebServer, unpackedWebServer, {
      recursive: true,
      force: true,
      filter: (src) => !src.includes('node_modules') && !src.endsWith('.log')
    });
    console.log('✓ win-unpacked web-server updated.');
  }

  if (fs.existsSync(destDir)) {
    console.log('Syncing bundle/web-server -> installed app resources/web-server...');
    fs.cpSync(bundleWebServer, path.join(destDir, 'web-server'), {
      recursive: true,
      force: true,
      filter: (src) => !src.includes('node_modules') && !src.endsWith('.log')
    });
    console.log('✓ installed app web-server updated.');
  }
}

console.log('✅ Sync completed successfully!');
