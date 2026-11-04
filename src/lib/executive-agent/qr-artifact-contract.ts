import { z } from 'zod';

/** Validate locally, encode exactly this string; never visit the destination. */
export function validateQrUrl(value:string):boolean {
  if(value.length>600||/[\s\u0000-\u001f\u007f]/u.test(value))return false;
  try{
    const url=new URL(value);
    return /^https?:\/\//i.test(value)&&['http:','https:'].includes(url.protocol)&&!!url.hostname&&!url.username&&!url.password;
  }catch{return false;}
}
export const GenerateQrInputSchema=z.object({
  clientId:z.string().uuid(),workspaceId:z.string().uuid(),
  url:z.string().trim().min(1).max(600).refine(validateQrUrl,'Supply an http(s) URL without whitespace or credentials.'),
  name:z.string().trim().min(1).max(191).default('QR Code'),
  ecc:z.enum(['L','M','Q','H']).default('M'),
  moduleShape:z.literal('square').default('square'),
  sizePx:z.number().int().min(128).max(2048).default(512),
  quietZone:z.number().int().min(4).max(16).default(4),
  foreground:z.literal('#000000').default('#000000'),
  background:z.literal('#ffffff').default('#ffffff'),
  uniqueMode:z.boolean().default(false),
}).strict();
export type GenerateQrInput=z.infer<typeof GenerateQrInputSchema>;
export const qrArtifactPrefix=(id:string)=>`/api/admin/executive-agent/qr/artifacts/${id}/`;
