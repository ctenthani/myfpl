const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'site');
fs.mkdirSync(target, { recursive: true });
for (const name of ['index.html','privacy.html','manifest.json','robots.txt','sw.js','_redirects','assets','css','icons','js']) fs.cpSync(path.join(root, name), path.join(target, name), { recursive: true });
console.log('Public app built in site; server source, tests and configuration excluded.');
