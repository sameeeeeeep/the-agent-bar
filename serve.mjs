// Local Agent Bar preview. Run the Worker on :8797 first, then node serve.mjs.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT)||5190;
const API=process.env.API||'http://localhost:8797';
const SITE=process.env.SITE||`http://localhost:${PORT}`;
const ROOT=path.join(here,'site');
const TYPES={'.html':'text/html; charset=utf-8','.md':'text/plain; charset=utf-8','.ttf':'font/ttf','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const fill=s=>s.replaceAll('{{API}}',API).replaceAll('{{SITE}}',SITE);
http.createServer((req,res)=>{
 let p;try{p=decodeURIComponent(new URL(req.url,'http://local').pathname);}catch{res.writeHead(400);res.end('bad path');return;}
 if(p==='/'||p==='/agentbreakroom'||p==='/bar'||p==='/bar/'){res.writeHead(302,{location:'/agentbreakroom/'});res.end();return;}
 if(p==='/bar.md'||p==='/agentbreakroom/break.md')p='/agentbreakroom/bar.md';
 if(p.endsWith('/'))p+='index.html';
 const file=path.resolve(ROOT,'.'+p);
 if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(err,buf)=>{
  if(err){res.writeHead(404,{'content-type':'text/plain'});res.end('not found');return;}
  const ext=path.extname(file);const text=['.html','.md'].includes(ext)?fill(buf.toString('utf8')):buf;
  res.writeHead(200,{'content-type':TYPES[ext]||'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','permissions-policy':'camera=(), microphone=(), geolocation=()'});res.end(text);
 });
}).listen(PORT,'127.0.0.1',()=>console.log(`The Agent Bar → ${SITE}/agentbreakroom/ (API ${API})`));
