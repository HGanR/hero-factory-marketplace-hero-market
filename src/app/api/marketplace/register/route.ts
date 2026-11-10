import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { mysql2ConnectionOptionsFromUrl } from '@/lib/db/mysql2-connection-options';
import { registerPendingAccount, registrationInput, RegistrationError } from '@/lib/marketplace/registration';
export const dynamic='force-dynamic';
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export function GET(){return reply({service:'marketplace-registration',version:2,sharedPendingAccounts:true,registrationAnalytics:true});}
export async function POST(request:NextRequest){
  if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'JSON required.'},415);
  let raw='';let size=0;const reader=request.body?.getReader();
  if(reader){const decoder=new TextDecoder();for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();return reply({error:'Registration request is too large.'},413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}
  let input;try{input=registrationInput(JSON.parse(raw));}catch(error){return reply({error:error instanceof RegistrationError?error.message:'Invalid registration request.'},400);}
  let connection:mysql.Connection|undefined;
  try{
    if(!process.env.DATABASE_URL)throw Error('Storage unavailable');
    const options=mysql2ConnectionOptionsFromUrl(process.env.DATABASE_URL);
    connection=typeof options==='string'?await mysql.createConnection(options):await mysql.createConnection(options);
    await connection.beginTransaction();
    const result=await registerPendingAccount(connection,input);await connection.commit();return reply(result);
  }catch(error){
    if(connection)await connection.rollback().catch(()=>{});
    if(error instanceof RegistrationError)return reply({error:error.message},error.status);
    if((error as {code?:string})?.code==='ER_DUP_ENTRY')return reply({error:'Email or username already registered. Use your existing account.'},409);
    return reply({error:'Registration could not be saved. Please retry when the account service is available.'},503);
  }finally{if(connection)await connection.end().catch(()=>{});}
}
