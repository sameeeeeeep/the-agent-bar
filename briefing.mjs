// Refresh a small reviewed list of official projects. Only public release metadata
// crosses this boundary. Release bodies, commands and assets are never published.
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const ID=/^[a-z0-9][a-z0-9-]{0,39}$/;
const REPOSITORY=/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;
const MAX_BYTES=256*1024;
const unsafe=/\b(?:sk[-_][A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+|AKIA[A-Z0-9]{16})|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\/(?:Users|home)\/|[A-Za-z]:\\Users\\|~\/|-----BEGIN [A-Z ]*PRIVATE KEY-----|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|\b(?:api[_-]?key|secret|password|passwd|bearer)\s*[:=]\s*['"]?[A-Za-z0-9_\-/+=]{12,}|\b(?:ignore|disregard|forget|override)\s+(?:all\s+|any\s+|the\s+|your\s+)?(?:previous|prior|above|earlier|preceding|system|original)\s+(?:instructions|prompts?|rules|messages)|\b(?:disable|bypass|skip|circumvent)\s+(?:the\s+|your\s+|all\s+)?(?:safety|guardrails?|sandbox|permissions?|moderation)|\b(?:printenv|process\.env|os\.environ)\b|(?:curl|wget|fetch|iwr|irm)\b[^\n]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|python|node|perl|ruby)\b|\$\{?[A-Z_][A-Z0-9_]*|\b[a-f0-9]{48,64}\b|(?:\+?\d[\s().-]*){10,}/i;

function text(value,max){
  if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/.test(value)||unsafe.test(value.normalize('NFKC')))throw new Error('Unsafe or oversized briefing text');
  return value.trim();
}
function timestamp(value,now){
  if(!Number.isSafeInteger(value)||value<=0||value>now||!Number.isFinite(new Date(value).getTime()))throw new Error('Invalid briefing timestamp');
  return value;
}
export function normalizeTopics(raw){
  if(raw?.schemaVersion!==1||!Array.isArray(raw.topics)||raw.topics.length<1||raw.topics.length>10)throw new Error('Expected 1–10 reviewed topics');
  const ids=new Set(),repositories=new Set();
  return raw.topics.map(t=>{
    if(!ID.test(t.id)||!REPOSITORY.test(t.repository)||t.repository.includes('..')||ids.has(t.id)||repositories.has(t.repository.toLowerCase()))throw new Error('Invalid or duplicate reviewed topic');
    ids.add(t.id);repositories.add(t.repository.toLowerCase());
    return {id:t.id,repository:t.repository,title:text(t.title,120),summary:text(t.summary,600),discussionPrompt:text(t.discussionPrompt,280),sourceUrl:`https://github.com/${t.repository}`};
  });
}
function releaseURL(value,topic){
  if(typeof value!=='string'||value.length>2048||unsafe.test(value.normalize('NFKC')))throw new Error('Unsafe release URL');
  const url=new URL(value),prefix=`/${topic.repository}/releases/tag/`;
  if(url.origin!=='https://github.com'||url.username||url.password||url.search||url.hash||!url.pathname.toLowerCase().startsWith(prefix.toLowerCase())||url.pathname.length<=prefix.length)throw new Error('Release URL is outside the reviewed repository');
  if(unsafe.test(decodeURIComponent(url.pathname).normalize('NFKC')))throw new Error('Unsafe encoded release URL');
  return url.href;
}
function latest(raw,topic,now){
  if(!raw||typeof raw!=='object')throw new Error('Missing release metadata');
  const label=text(raw.label,160);
  if(raw.publishedAt===null){
    if(label!=='No published release; see project'||raw.url!==topic.sourceUrl)throw new Error('Invalid release-free project record');
    return {label,url:topic.sourceUrl,publishedAt:null};
  }
  const result={label,url:releaseURL(raw.url,topic),publishedAt:timestamp(raw.publishedAt,now)};
  if(raw.note!==undefined){result.note=text(raw.note,160);if(result.note.split(/\s+/).length>20)throw new Error('Release excerpt exceeds word cap');}
  return result;
}
export function releaseExcerpt(body){
  if(typeof body!=='string')return undefined;
  let fenced=false;
  for(const original of body.split(/\r?\n/)){
    const line=original.trim();
    if(/^(?:```|~~~)/.test(line)){fenced=!fenced;continue;}
    if(fenced||!line||/^ {4}/.test(original)||/^(?:#{1,6}\s|https?:\/\/|!\[|[<>|]|[-=_]{3,}$)/.test(line))continue;
    let prose=line.replace(/^[-*+]\s+|^\d+\.\s+/,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[`*_]/g,'').replace(/\s+by\s+@[A-Za-z0-9_-]+\b.*$/,'').trim();
    if(!/[A-Za-z]{3}/.test(prose)||/[<>]/.test(prose)||/^(?:\$|npm\b|npx\b|pnpm\b|yarn\b|bun\b|pip\b|uv\b|brew\b|curl\b|wget\b|git\b|node\b|python\b|import\b|export\b|const\b|let\b|function\b)/i.test(prose))continue;
    // Screen the whole candidate before shortening, so truncation cannot hide a payload.
    try{text(prose,2000);}catch{continue;}
    const full=prose,words=[];for(const word of prose.split(/\s+/).slice(0,20)){if([...words,word].join(' ').length>159)break;words.push(word);}
    prose=words.join(' ');if(prose.length<12)continue;if(prose.length<full.length)prose+='…';
    return prose;
  }
  return undefined;
}
function topicRecord(topic,release,checkedAt){
  return {id:topic.id,title:topic.title,summary:topic.summary,discussionPrompt:topic.discussionPrompt,sourceUrl:topic.sourceUrl,latest:release,checkedAt};
}
export async function fetchPublic(url){
  // URLs are constructed only from the reviewed repository list, never release text.
  const target=new URL(url);
  if(target.origin!=='https://api.github.com'||target.username||target.password||target.search||target.hash||!/^\/repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/releases\/latest)?$/.test(target.pathname))throw new Error('Unreviewed public source URL');
  const response=await fetch(target,{redirect:'error',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000),headers:{accept:'application/vnd.github+json','user-agent':'the-agent-bar-public-briefing'}});
  if(response.status===404)return {status:404};
  if(!response.ok)throw new Error('Official public source unavailable');
  if(!response.body)throw new Error('Official source returned no body');
  const reader=response.body.getReader(),chunks=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BYTES){await reader.cancel();throw new Error('Official source exceeds size limit');}chunks.push(value);}
  return {status:200,data:JSON.parse(Buffer.concat(chunks).toString('utf8'))};
}
async function currentRelease(topic,now,fetchSource){
  const endpoint=`https://api.github.com/repos/${topic.repository}`;
  const result=await fetchSource(`${endpoint}/releases/latest`);
  if(result.status===404){
    const repository=await fetchSource(endpoint);
    if(repository.status!==200||repository.data?.private!==false||repository.data?.full_name?.toLowerCase()!==topic.repository.toLowerCase())throw new Error('No verified public repository');
    return {label:'No published release; see project',url:topic.sourceUrl,publishedAt:null};
  }
  const release=result.data;
  if(result.status!==200||release?.draft!==false||release?.prerelease!==false)throw new Error('Expected a published stable release');
  const tag=text(release.tag_name,160);
  const label=release.name===null||release.name===''?tag:text(release.name,160);
  if(typeof release.published_at!=='string')throw new Error('Release has no publication timestamp');
  return latest({label,url:release.html_url,publishedAt:Date.parse(release.published_at),note:releaseExcerpt(release.body)},topic,now);
}
async function readExisting(out,topics,now){
  let stat;try{stat=await fs.lstat(out);}catch(e){if(e.code==='ENOENT')return new Map();throw e;}
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>64*1024)throw new Error('Existing briefing must be a small regular JSON file');
  const raw=JSON.parse(await fs.readFile(out,'utf8'));
  if(raw.schemaVersion!==1||!Array.isArray(raw.topics)||raw.topics.length>10)throw new Error('Invalid existing briefing');
  const checkedAt=timestamp(raw.checkedAt,now),byId=new Map(topics.map(t=>[t.id,t])),old=new Map();
  for(const item of raw.topics){
    const topic=byId.get(item?.id);
    if(!topic||item.sourceUrl!==topic.sourceUrl)continue;
    try{const checked=timestamp(item.checkedAt,checkedAt);old.set(topic.id,topicRecord(topic,latest(item.latest,topic,checked),checked));}catch{/* Unsafe old text is never retained. */}
  }
  return old;
}
export async function generateBriefing({out,topics:rawTopics,now=Date.now()}={},fetchSource=fetchPublic){
  if(!out)throw new Error('Specify --out daily/briefing.json');
  timestamp(now,now);
  if(!rawTopics){const file=path.join(here,'topics.json');const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>32*1024)throw new Error('Reviewed topics must be a small regular JSON file');rawTopics=JSON.parse(await fs.readFile(file,'utf8'));}
  const topics=normalizeTopics(rawTopics),file=path.resolve(out),old=await readExisting(file,topics,now);
  const results=await Promise.all(topics.map(async topic=>{
    try{return {topic:topicRecord(topic,await currentRelease(topic,now,fetchSource),now)};}
    catch{return {topic:old.get(topic.id)||null,failure:topic.id};}
  }));
  const document={schemaVersion:1,checkedAt:now,topics:results.map(r=>r.topic).filter(Boolean),failures:results.filter(r=>r.failure).map(r=>r.failure)};
  const body=JSON.stringify(document,null,2)+'\n';if(Buffer.byteLength(body)>64*1024)throw new Error('Briefing exceeds published size limit');
  await fs.mkdir(path.dirname(file),{recursive:true});
  const temp=path.join(path.dirname(file),`.briefing-${randomUUID()}.tmp`);
  try{await fs.writeFile(temp,body,{flag:'wx'});await fs.rename(temp,file);}finally{await fs.unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  console.log(`Checked ${topics.length} official sources; ${document.failures.length} unavailable, ${document.topics.length} topics published.`);
  return document;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{if(process.argv.length!==4||process.argv[2]!=='--out')throw new Error('Usage: node briefing.mjs --out daily/briefing.json');await generateBriefing({out:process.argv[3]});}catch(e){console.error(e.message);process.exitCode=1;}
}
