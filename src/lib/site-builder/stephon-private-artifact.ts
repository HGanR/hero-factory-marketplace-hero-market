import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { load } from 'cheerio';
import type { generateStaticBundle } from '@/lib/site-builder/static-generator';

type Bundle = ReturnType<typeof generateStaticBundle>;
export const PREVIEW_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export const PREVIEW_RAW_LIMIT = 2_000_000;
export const TEXT_STORAGE_LIMIT = 60_000;
export const previewMemoryId = (versionId: string) => createHash('sha256').update('stephon-preview:'+versionId).digest('hex').slice(0,32);
export const previewPrefix = (versionId: string) => `/api/admin/executive-agent/stephon/preview/${versionId}/`;
export const hash = (content: string) => createHash('sha256').update(content).digest('hex');
export function assertTextFits(value: string) {
  if (Buffer.byteLength(value, 'utf8') > TEXT_STORAGE_LIMIT) throw Error('Draft exceeds existing TEXT storage limit; no partial artifact saved.');
}
export function safeArtifactPath(path: string) {
  return /^[a-zA-Z0-9][a-zA-Z0-9_./-]*\.(html|css)$/.test(path) && !path.split('/').some(p=>p==='..'||p==='.'||!p);
}

/** Materialize the exact inert preview bytes before hashing/storage; no remote loads. */
export function preparePrivateBundle(bundle: Bundle, versionId: string) {
  const paths = new Set(bundle.files.map(f=>f.path));
  if (!paths.has('index.html') || paths.size !== bundle.files.length || paths.size > 40) throw Error('Invalid preview bundle');
  const files = bundle.files.map(file=>{
    if (!safeArtifactPath(file.path)) throw Error('Unsafe artifact path');
    let content = file.content;
    if (file.contentType === 'text/html') {
      const $ = load(content);
      $('script,iframe,object,embed,form,base,meta[http-equiv],link[rel="preconnect"],link[rel="dns-prefetch"]').remove();
      $('*').each((_i,el)=>{
        for (const key of Object.keys(('attribs' in el && el.attribs) || {})) {
          if (/^on/i.test(key) || ['srcdoc','srcset','ping','formaction'].includes(key)) $(el).removeAttr(key);
        }
      });
      $('[href]').each((_i,el)=>{
        const href = $(el).attr('href') || '';
        if (href.startsWith('#')) return;
        const local = href.replace(/^\.\//,'').replace(/^\//,'');
        const target=paths.has(local)?local:paths.has(local+'.html')?local+'.html':local===''?'index.html':null;
        if (target && el.tagName === 'link' && target.endsWith('.css')) {
          // An opaque sandbox must not depend on cookie-bearing stylesheet subrequests.
          const css=bundle.files.find(f=>f.path===target)?.content || '';
          $(el).replaceWith($('<style>').text(css.replace(/<\/style/gi,'<\\/style')));
        } else if (target) $(el).attr('href',previewPrefix(versionId)+target);
        else if (el.tagName === 'link') $(el).remove();
        else $(el).attr('href','#');
      });
      $('[src]').each((_i,el)=>{const src=$(el).attr('src')||'';if(!/^data:image\/(png|jpeg|webp);base64,/.test(src))$(el).removeAttr('src');});
      content = $.html();
    } else if (file.contentType !== 'text/css') throw Error('Unsupported preview type');
    return {...file, content, bytes:Buffer.byteLength(content), sha256:hash(content)};
  });
  const raw=JSON.stringify({files});
  if(Buffer.byteLength(raw)>PREVIEW_RAW_LIMIT)throw Error('Preview exceeds bounded artifact budget');
  const packed=gzipSync(raw).toString('base64');
  return {packed, files:files.map(({content:_content,...meta})=>meta)};
}

export function readPrivateBundle(packed: string) {
  const raw=gunzipSync(Buffer.from(packed,'base64'),{maxOutputLength:PREVIEW_RAW_LIMIT}).toString('utf8');
  const data=JSON.parse(raw) as {files:Bundle['files']};
  if(!Array.isArray(data.files)||data.files.length>40)throw Error('Invalid stored preview');
  for(const file of data.files){
    if(!safeArtifactPath(file.path)||typeof file.content!=='string'||hash(file.content)!==file.sha256||Buffer.byteLength(file.content)!==file.bytes)throw Error('Stored artifact integrity failure');
  }
  return data.files;
}
