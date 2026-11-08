// Pure policy shared by entry and media-token issuance. No client role is trusted.
export function decideStadium(node: {isActive:boolean;webEnabled:boolean;accessType:string;createdByUserId:number|null}, user:number|null, invited:boolean) {
  if (!node.isActive || !node.webEnabled) return {status:403,host:false};
  const host=user!==null && user===node.createdByUserId;
  if (host || node.accessType==='public') return {status:200,host};
  return {status:user===null?401:invited?200:403,host:false};
}
export function validPass(inv:{status:string;expiresAt:Date|string|null;inviteeUserId:number|null;inviteeEmail:string|null;inviteeWallet:string|null}|undefined,user:number|null,now:number) {
  return !!inv && user!==null && inv.status==='pending' && !!inv.expiresAt && new Date(inv.expiresAt).getTime()>now &&
    !inv.inviteeEmail && !inv.inviteeWallet && (inv.inviteeUserId===null || inv.inviteeUserId===user);
}
