import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { posix } from 'node:path';
import { load } from 'cheerio';
import { hash, previewPrefix, safeArtifactPath } from './stephon-private-artifact';

type File = {path:string;content:string;contentType:string;sha256:string;bytes:number};
const policy="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";

/** Portable, inert review copy. This is neither the live site nor a publication. */
export function packagePrivateDraft(files:File[],versionId:string) {
  if(!/^[a-f0-9-]{36}$/.test(versionId)||files.length>40||!files.some(f=>f.path==='index.html'))throw Error('Invalid download bundle');
  const paths=new Set(files.map(f=>f.path));
  if(paths.size!==files.length)throw Error('Duplicate download path');
  const entries=files.map(file=>{
    if(!safeArtifactPath(file.path)||Buffer.byteLength(file.path)>100||hash(file.content)!==file.sha256||Buffer.byteLength(file.content)!==file.bytes)throw Error('Invalid download file');
    let content=file.content;
    if(file.contentType==='text/html'){
      const $=load(content);
      // Exported pages must not reference administrator-only API paths.
      $('[href]').each((_i,el)=>{
        const href=$(el).attr('href')||'';
        if(href.startsWith('#'))return;
        const target=href.startsWith(previewPrefix(versionId))?href.slice(previewPrefix(versionId).length):null;
        $(el).attr('href',target&&paths.has(target)?posix.relative(posix.dirname(file.path),target):'#');
      });
      $('meta[http-equiv]').remove();
      $('head').prepend($('<meta>').attr('http-equiv','Content-Security-Policy').attr('content',policy));
      content=$.html();
    }else if(file.contentType!=='text/css')throw Error('Unsupported download type');
    return {path:file.path,content,sha256:hash(content),bytes:Buffer.byteLength(content)};
  });
  const manifest={kind:'stephon_review_download_v1',versionId,qualityStatus:'review_required',publication:'not_published',
    limits:'Inert review copy. Forms, scripts, external assets and outgoing links are disabled. Review content and appearance before sharing. This is not a working production website.',
    files:entries.map(({content:_content,...entry})=>entry)};
  entries.push({path:'REVIEW-MANIFEST.json',content:JSON.stringify(manifest,null,2),sha256:'',bytes:0});
  const chunks:Buffer[]=[];
  let total=0;
  for(const entry of entries){
    const data=Buffer.from(entry.content);total+=data.length;
    if(total>2_100_000)throw Error('Download exceeds bounded budget');
    const header=Buffer.alloc(512);
    header.write(entry.path,0,100,'utf8');
    const octal=(value:number,offset:number,length:number)=>header.write(value.toString(8).padStart(length-1,'0')+'\0',offset,length,'ascii');
    octal(0o644,100,8);octal(0,108,8);octal(0,116,8);octal(data.length,124,12);octal(0,136,12);
    header.fill(32,148,156);header[156]=48;header.write('ustar\0',257,6,'ascii');header.write('00',263,2,'ascii');
    const checksum=header.reduce((sum,byte)=>sum+byte,0);
    header.write(checksum.toString(8).padStart(6,'0')+'\0 ',148,8,'ascii');
    chunks.push(header,data,Buffer.alloc((512-data.length%512)%512));
  }
  chunks.push(Buffer.alloc(1024));
  const archive=gzipSync(Buffer.concat(chunks));
  return {archive,sha256:createHash('sha256').update(archive).digest('hex'),bytes:archive.length,manifest};
}
