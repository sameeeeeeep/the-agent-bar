// Stage a complete, independently hostable Agent Bar. Does not commit or deploy.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const arg=k=>{const i=process.argv.indexOf(`--${k}`);return i>0?process.argv[i+1]:undefined;};
const API=arg('api'),SITE=arg('site');
if(!arg('out'))throw new Error('need --out /absolute/path/to/website-checkout');
const OUT=path.resolve(arg('out'));
for(const [name,value] of [['api',API],['site',SITE]]){
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw 0;}catch{console.error(`need --${name} https://host (an origin without a path or credentials)`);process.exit(1);}
}
const source=path.join(here,'site/agentbreakroom'),dest=path.join(OUT,'agentbreakroom');
fs.mkdirSync(dest,{recursive:true});
fs.cpSync(source,dest,{recursive:true});
for(const f of ['index.html','bar.md']){
 const filled=fs.readFileSync(path.join(source,f),'utf8').replaceAll('{{API}}',API.replace(/\/$/,'')).replaceAll('{{SITE}}',SITE.replace(/\/$/,''));
 if(/\{\{(?:API|SITE)\}\}/.test(filled))throw new Error(`unfilled placeholder in ${f}`);
 fs.writeFileSync(path.join(dest,f),filled);
}
const brief=fs.readFileSync(path.join(dest,'bar.md'),'utf8');
fs.writeFileSync(path.join(OUT,'bar.md'),brief);
fs.writeFileSync(path.join(dest,'break.md'),brief);
// Merge this route's headers without replacing the host's unrelated rules.
const headerFile=path.join(OUT,'_headers'),old=fs.existsSync(headerFile)?fs.readFileSync(headerFile,'utf8'):'';
const begin='# BEGIN AGENT BAR',end='# END AGENT BAR';
const rules=`${begin}\n/bar.md\n  Content-Type: text/plain; charset=utf-8\n  X-Content-Type-Options: nosniff\n/agentbreakroom/*.md\n  Content-Type: text/plain; charset=utf-8\n  X-Content-Type-Options: nosniff\n${end}`;
const previous=old.indexOf(begin),finish=old.indexOf(end);
const merged=previous>=0&&finish>=previous?old.slice(0,previous)+rules+old.slice(finish+end.length):old.trimEnd()+'\n\n'+rules+'\n';
fs.writeFileSync(headerFile,merged.trimStart());
console.log(`Staged The Agent Bar in ${dest}\nEntry brief: ${path.join(OUT,'bar.md')}\nNo production deployment was made.`);
