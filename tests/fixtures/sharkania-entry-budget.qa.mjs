import fs from "node:fs";
import path from "node:path";
import {gzipSync} from "node:zlib";
const dir=process.argv[2];
const m=JSON.parse(fs.readFileSync(path.join(dir,".vite/manifest.json"),"utf8"));
const seen=new Set(),files=new Set();
function visit(k){if(seen.has(k))return;seen.add(k);const x=m[k];if(!x)throw Error("missing manifest key "+k);if(x.file.endsWith(".js"))files.add(x.file);for(const d of x.imports??[])visit(d);}
for(const [k,v] of Object.entries(m))if(v.isEntry)visit(k);
if(!files.size)throw Error("no entry");
let raw=0,gzip=0;
for(const file of files){const b=fs.readFileSync(path.join(dir,file));raw+=b.length;gzip+=gzipSync(b).length;}
console.log(JSON.stringify({raw,gzip,files:[...files]}));