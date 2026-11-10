export const REGISTRATION_EVENT_PREFIX='account.registration.';
export function registrationBriefingActivity(rows: ReadonlyArray<{eventName:string;clicks:number}> = []) {
  let mobile=0,website=0,mobileTrooPayPalClicks=0;
  for(const row of rows){const count=Number.isFinite(Number(row.clicks))?Math.max(0,Number(row.clicks)):0;
    if(row.eventName===REGISTRATION_EVENT_PREFIX+'mobile')mobile+=count;
    if(row.eventName===REGISTRATION_EVENT_PREFIX+'website')website+=count;
    if(row.eventName==='mobile.troo_token.paypal.open')mobileTrooPayPalClicks+=count;
  }
  return {mobile,website,total:mobile+website,mobileTrooPayPalClicks};
}
