const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..','site');
process.env.SITE_URL = 'http://localhost:4178';
process.env.AUTH_SECRET = 'local-preview-only-no-production-access';
http.createServer(async (req,res) => {
 try {
  const url = new URL(req.url,'http://localhost:4178');
  if(url.pathname.startsWith('/api/')) {
   const name=url.pathname.slice(5);
   if(!['fpl','coach','account','billing','votes','members','subscribe','plans'].includes(name)){res.writeHead(404);res.end();return;}
   let body='';for await(const chunk of req){body+=chunk;if(body.length>25000)throw Error('Too large');}
   const result=await require('../netlify/functions/'+name+'.js').handler({httpMethod:req.method,headers:req.headers,body,queryStringParameters:Object.fromEntries(url.searchParams)});
   res.writeHead(result.statusCode,result.headers||{});res.end(result.body);return;
  }
  const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
  const content=fs.readFileSync(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);
 }catch{res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Preview service unavailable.'}));}
}).listen(4178,'127.0.0.1',()=>console.log('Preview on http://localhost:4178. Production billing and emails unavailable.'));
