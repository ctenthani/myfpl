const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'site');
fs.mkdirSync(target, { recursive: true });
for (const name of ['index.html','privacy.html','manifest.json','robots.txt','sw.js','_redirects','assets','css','icons','js']) fs.cpSync(path.join(root, name), path.join(target, name), { recursive: true });
const functions = path.join(root, 'deploy-functions');
fs.rmSync(functions, { recursive: true, force: true });
fs.mkdirSync(functions, { recursive: true });
for (const name of ['fpl.js','votes.js','subscribe.js','members.js','matchday-digest.js','lib']) fs.cpSync(path.join(root,'netlify','functions',name),path.join(functions,name),{recursive:true});
// Native Request handlers receive Netlify's scoped Blobs context automatically.
// Preserve the tested legacy handlers behind a small request/response adapter.
fs.mkdirSync(path.join(functions,'lib','handlers'), { recursive: true });
for (const name of ['account','billing','paypal-webhook','coach']) {
  const source = fs.readFileSync(path.join(root,'netlify','functions',name+'.js'),'utf8').replaceAll("require('./lib/", "require('../");
  fs.writeFileSync(path.join(functions,'lib','handlers',name+'.cjs'),source);
  fs.writeFileSync(path.join(functions,name+'.mjs'),`import legacy from './lib/handlers/${name}.cjs';
export default async function(request) {
  const event = { httpMethod: request.method, headers: Object.fromEntries(request.headers), body: ['GET','HEAD'].includes(request.method) ? '' : await request.text() };
  const result = await legacy.handler(event);
  return new Response(result.body, { status: result.statusCode, headers: result.headers });
}
`);
}
console.log('Public app built in site; server source, tests and configuration excluded.');
