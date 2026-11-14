export const MAX_STADIUM_CLIP_BYTES=3*1024*1024;
export class StadiumMediaError extends Error{}
/** Bounds-checked ISO BMFF metadata, read without executing a decoder on the server. */
export function inspectStadiumMp4(bytes:Uint8Array){
 function bad(message='Choose a valid H.264 MP4 clip'):never{throw new StadiumMediaError(message)}
 if(bytes.length<32||bytes.length>MAX_STADIUM_CLIP_BYTES)bad('MP4 clips must be at most 3 MB');
 const data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),ascii=(n:number)=>String.fromCharCode(...bytes.subarray(n,n+4));
 type Box={type:string;start:number;end:number;data:number};
 const boxes=(start:number,end:number)=>{const out:Box[]=[];for(let p=start;p<end;){if(end-p<8)bad();let size=data.getUint32(p),header=8;if(size===1){if(end-p<16)bad();const long=data.getBigUint64(p+8);if(long>BigInt(Number.MAX_SAFE_INTEGER))bad();size=Number(long);header=16;}if(size===0)size=end-p;if(size<header||p+size>end)bad();out.push({type:ascii(p+4),start:p,end:p+size,data:p+header});p+=size;}return out;};
 const child=(parent:Box,type:string)=>boxes(parent.data,parent.end).find(b=>b.type===type);
 const top=boxes(0,bytes.length);if(!top.some(b=>b.type==='ftyp'))bad();const moov=top.find(b=>b.type==='moov');if(!moov)bad('This MP4 has no movie metadata');
 const movie=child(moov,'mvhd');if(!movie||movie.end-movie.data<24)bad();const v=data.getUint8(movie.data);if(v!==0&&v!==1)bad();if(v===1&&movie.end-movie.data<36)bad();const timescale=data.getUint32(movie.data+(v===1?20:12)),ticks=v===1?Number(data.getBigUint64(movie.data+24)):data.getUint32(movie.data+16),duration=ticks/timescale;
 if(!Number.isFinite(duration)||duration<=0||duration>30)bad('Choose an MP4 no longer than 30 seconds');
 let dimensions:{width:number;height:number}|undefined;
 for(const track of boxes(moov.data,moov.end).filter(b=>b.type==='trak')){const mdia=child(track,'mdia');if(!mdia)continue;const handler=child(mdia,'hdlr');if(!handler||handler.end-handler.data<12||ascii(handler.data+8)!=='vide')continue;
  const tkhd=child(track,'tkhd'),minf=child(mdia,'minf'),stbl=minf&&child(minf,'stbl'),stsd=stbl&&child(stbl,'stsd');if(!tkhd||tkhd.end-tkhd.data<84||!stsd||stsd.end-stsd.data<16)bad();
  const codec=ascii(stsd.data+12);if(codec!=='avc1'&&codec!=='avc3')bad('Export the clip as H.264 MP4 for browser playback');
  const width=data.getUint32(tkhd.end-8)/65536,height=data.getUint32(tkhd.end-4)/65536;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>1920||height>1080)bad('Use a clip at most 1920 × 1080 pixels');dimensions={width,height};break;
 }
 if(!dimensions)bad('This MP4 has no supported video track');return{duration,...dimensions!};
}
