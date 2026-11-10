import { randomUUID } from 'node:crypto';
export type RegistrationSource = 'website' | 'mobile';
export interface RegistrationConnection { execute(sql: string, values?: any[]): Promise<any>; }
export class RegistrationError extends Error { constructor(message: string, public status=400) {super(message);} }
export function registrationInput(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RegistrationError('Enter your email and username.');
  const body=input as Record<string,unknown>;
  if (typeof body.email !== 'string' || typeof body.username !== 'string') throw new RegistrationError('Email and username are required.');
  const email=body.email.trim().toLowerCase(), username=body.username.trim();
  if (email.length>320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !username || username.length>100 || /[\u0000-\u001f\u007f]/.test(username)) throw new RegistrationError('Enter a valid email and a username of up to 100 characters.');
  const source=body.registrationSource ?? 'website';
  if (source!=='mobile' && source!=='website') throw new RegistrationError('Invalid registration source.');
  return {email,username,source:source as RegistrationSource};
}
// Account and analytics event commit together in the caller's isolated transaction.
export async function registerPendingAccount(db: RegistrationConnection, input: ReturnType<typeof registrationInput>) {
  const [existing]=await db.execute('SELECT id FROM marketplace_users WHERE email = ? OR username = ? LIMIT 1',[input.email,input.username]);
  if(existing.length)throw new RegistrationError('Email or username already registered. Use your existing account or contact support.',409);
  const [created]=await db.execute('INSERT INTO marketplace_users (email, username, passwordHash, isActive, isApproved, walletAddress, hasTokenAccess, lastLogin) VALUES (?, ?, NULL, 0, 0, NULL, 0, NULL)',[input.email,input.username]);
  const id=Number(created.insertId);if(!Number.isSafeInteger(id)||id<1)throw new Error('Account insert was not confirmed.');
  const eventId=randomUUID();
  await db.execute('INSERT INTO site_analytics_events (id, sessionId, visitorId, path, eventType, source, medium, campaign, referrer, userAgent, metadataJson) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)',[
    eventId,'registration:'+id,'registration:'+id,input.source==='mobile'?'/mobile':'/','conversion_intent',input.source,'account_registration','',
    JSON.stringify({eventName:'account.registration.'+input.source,label:input.source==='mobile'?'Mobile app account registered — pending approval':'Website account registered — pending approval',registrationSource:input.source,marketplaceUserId:String(id),accountStatus:'pending',paymentVerified:false}),
  ]);
  return {success:true,pending:true,analyticsRecorded:true,message:'Registration received. Your account is pending administrator approval. Use the generated password after approval.'};
}
