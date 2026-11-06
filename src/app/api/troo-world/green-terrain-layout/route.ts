import {NextResponse} from 'next/server';
import {loadGreenLayout} from '@/lib/troo-world/green-terrain-store';
export const dynamic='force-dynamic';export const revalidate=0;
export async function GET(){
 try{const row=await loadGreenLayout();return NextResponse.json(row?{ok:true,...row}:{ok:true,missing:true},{headers:{'Cache-Control':'no-store'}})}
 catch{return NextResponse.json({ok:false,error:'Saved town layout is unavailable. Try again later.'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
