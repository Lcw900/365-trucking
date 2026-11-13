import {cp,mkdir,readFile,readdir,writeFile,stat,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(app,process.argv[3]||'.cloudflare-dist');
const origin=process.argv[2]||'https://365-trucking.pages.dev';
if(!/^https:\/\/[a-z0-9-]+\.pages\.dev$/.test(origin))throw Error('Use the verified HTTPS pages.dev origin.');
// This folder is a generated package only; do not include source, SQL, credentials or test previews.
try{await access(output);throw Error('The output folder already exists. Archive it before preparing a new package.')}catch(error){if(error.code!=='ENOENT')throw error}
await mkdir(output);
await cp(path.join(app,'dist'),output,{recursive:true,filter:source=>!path.basename(source).includes('preview')});
const index=path.join(output,'index.html');let html=await readFile(index,'utf8');html=html.replaceAll('https://365-trucking.pages.dev',origin);await writeFile(index,html);
await writeFile(path.join(output,'_headers'),'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n\n/index.html\n  Cache-Control: no-cache\n');
let count=0,maxBytes=0;
async function check(dir){for(const ent of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,ent.name);if(ent.isDirectory()){await check(file);continue}const info=await stat(file);count++;maxBytes=Math.max(maxBytes,info.size);if(info.size>25*1024*1024)throw Error('Cloudflare asset exceeds 25 MiB: '+ent.name);if(/\.(html|js|json|css)$/.test(ent.name)){const text=await readFile(file,'utf8');if(/sb_secret_[a-zA-Z0-9_-]{16,}|sk_live_[a-zA-Z0-9]{16,}|sbp_[a-f0-9]{32,}/.test(text))throw Error('Unexpected private credential in deployment output.')}}}
await check(output);
for(const attr of ['property="og:image"','name="twitter:image"'])if(!html.includes(attr))throw Error('Missing social preview metadata');
console.log(JSON.stringify({output,origin,files:count,largestAssetBytes:maxBytes,previewImage:origin+'/assets/share/365-trucking-share-v3.jpg'}));
