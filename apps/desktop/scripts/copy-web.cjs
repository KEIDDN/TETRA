// Copies the built web app into the desktop package, where main.cjs serves it.
const fs = require('node:fs');
const path = require('node:path');
const from = path.join(__dirname, '..', '..', 'web', 'dist');
const to = path.join(__dirname, '..', 'web');
fs.rmSync(to, { recursive: true, force: true });
fs.cpSync(from, to, { recursive: true });
console.log(`web → ${to}`);
