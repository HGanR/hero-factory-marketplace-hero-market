const $ = id => document.getElementById(id);
let generation = 0;
let busy = false;
let pendingTerms = null;
let memberWorlds = null;
let currentMember = null;
let savedProfile = null;
let activeWorld = null;
let worldDirty = false;
let worldWriting = false;
const imageSelections = new Map();
function clearAccount() {
  $('account').hidden = true;
  currentMember = null; memberWorlds = null; savedProfile = null;
  activeWorld = null; worldDirty = false; $('worldEditor').hidden = true; $('placementList').replaceChildren(); $('worldAddress').value = ''; $('worldSaveMessage').textContent = '';
  $('appearanceSetup').hidden = true; $('finishSetup').disabled = true; $('editAppearance').hidden = true;
  $('setupUsername').textContent = ''; $('setupMessage').textContent = '';
  applySkinChoice('gold');
  $('profileAppearance').hidden = true; $('saveProfile').hidden = true; $('appearanceMessage').textContent = '';
  $('profileScreen').hidden = false; $('explorer').hidden = true;
  $('profileImageControls').hidden = true; $('journeyBtn').hidden = true; $('journeyBtn').disabled = true;
  $('profileBanner').removeAttribute('src'); $('profileAvatar').removeAttribute('src');
  $('profileBanner').hidden = true; $('profileAvatar').hidden = true;
  $('bannerPlaceholder').hidden = false; $('avatarPlaceholder').hidden = false;
  $('avatarPlaceholder').textContent = ''; $('profileMessage').textContent = '';
  $('worldList').replaceChildren(); $('worldMessage').textContent = '';
  $('termsGate').hidden = true; $('termsForm').hidden = true;
  $('termsAccepted').checked = false; $('acceptTerms').disabled = true; pendingTerms = null;
  $('termsReceipt').hidden = true; $('termsReceipt').textContent = '';
  for (const id of ['username', 'email', 'memberId', 'wallet', 'welcome']) $(id).textContent = '';
}
function status(message) { $('status').textContent = message; }
async function request(method = 'GET', body, path = '/api/mobile/session') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(path, {method, credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      headers: body ? {'Content-Type':'application/json'} : {}, body: body ? JSON.stringify(body) : undefined});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.error || 'Account service unavailable (' + response.status + ').'); error.status = response.status; throw error; }
    return data;
  } finally { clearTimeout(timer); }
}
async function refreshSession() {
  const current = ++generation;
  clearAccount(); $('signin').hidden = true; status('Checking your website session…');
  try {
    const data = await request();
    if (current !== generation) return;
    if (data.access === 'terms_required' || data.access === 'terms_unavailable') {
      $('termsGate').hidden = false;
      $('termsMessage').textContent = data.access === 'terms_required' ? 'Before opening your profile, review and accept the current member terms.' : 'Member terms are being finalized. Your profile remains unavailable until they are published.';
      $('termsVersion').textContent = '';
      if (data.access === 'terms_required') {
        if (!data.terms || typeof data.terms.version !== 'string' || typeof data.terms.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(data.terms.sha256)) throw new Error('The terms document could not be verified. Please retry.');
        pendingTerms = {version: data.terms.version, sha256: data.terms.sha256};
        $('termsVersion').textContent = 'Agreement version: '+pendingTerms.version;
        $('termsForm').hidden = false;
      }
      status('Member terms required before profile access.');
      return;
    }
    const {user} = data;
    const administrator = user?.role === 'administrator';
    if (!user || typeof user.username !== 'string' || !user.username || (!administrator && (!Number.isSafeInteger(user.id) || user.id < 1 || typeof user.email !== 'string'))) throw new Error('Account service returned an invalid profile.');
    $('welcome').textContent = administrator ? 'ADMINISTRATOR · ' + user.username : user.username;
    $('username').textContent = 'Username: ' + user.username;
    $('email').textContent = administrator ? 'Website administrator account' : 'Email: ' + user.email;
    $('memberId').textContent = administrator ? 'Account type: Administrator' : 'Account ID: ' + user.id;
    $('wallet').textContent = administrator ? 'Member wallet data is separate from this administrator session.' : user.walletAddress ? 'Saved wallet: ' + user.walletAddress : 'No wallet address saved.';
    currentMember = administrator ? null : user.id;
    $('setupUsername').textContent = 'Website username: ' + user.username;
    $('avatarPlaceholder').textContent = user.username.slice(0, 2).toUpperCase();
    $('account').hidden = false;
    if (!administrator) { $('profileScreen').hidden = true; $('journeyBtn').hidden = false; await loadProfile(current); }
    status(administrator ? 'Website administrator session confirmed.' : 'Website session confirmed.');
    if (!administrator && data.termsAcceptance && typeof data.termsAcceptance.acceptedAt === 'string') {
      $('termsReceipt').textContent = 'Terms '+data.termsAcceptance.version+' accepted (UTC): '+data.termsAcceptance.acceptedAt;
      $('termsReceipt').hidden = false;
    }
  } catch (error) {
    if (current !== generation) return;
    clearAccount(); $('signin').hidden = false;
    status(error.name === 'AbortError' ? 'The server took too long. Please retry.' : error.message);
  }
}
function showProfileImages(profile) {
  // Only raster data saved by the profile endpoint or an HTTPS website avatar thumbnail.
  const banner = typeof profile.bannerData === 'string' && profile.bannerData.startsWith('data:image/png;base64,') ? profile.bannerData : null;
  const candidate = profile.avatarData || profile.selectedAvatar?.thumbnailUrl;
  const avatar = typeof candidate === 'string' && (candidate.startsWith('data:image/png;base64,') || /^https:\/\//.test(candidate)) ? candidate : null;
  for (const [id, placeholder, src] of [['profileBanner','bannerPlaceholder',banner],['profileAvatar','avatarPlaceholder',avatar]]) {
    $(id).removeAttribute('src'); $(id).hidden = !src; $(placeholder).hidden = !!src;
    if (src) $(id).src = src;
  }
}
for (const [id, placeholder] of [['profileBanner','bannerPlaceholder'],['profileAvatar','avatarPlaceholder']]) {
  $(id).addEventListener('error', () => { $(id).hidden = true; $(id).removeAttribute('src'); $(placeholder).hidden = false; });
}
async function loadProfile(current) {
  $('profileMessage').textContent = 'Loading your saved profile images…';
  try {
    const data = await request('GET', undefined, '/api/mobile/profile');
    if (current !== generation) return;
    if (!data.profile) throw new Error('Profile images could not be loaded.');
    showProfileImages(data.profile); memberWorlds = data.worlds;
    savedProfile = data.profile;
    applySkinChoice(data.profile.skin);
    $('profileAppearance').hidden = false; $('saveProfile').hidden = false; $('saveProfile').disabled = !hasProfileImage(savedProfile);
    $('editAppearance').hidden = false;
    // An unavailable avatar service is not proof that no avatar is assigned.
    showAppearance(!hasProfileImage(data.profile) && data.profile.avatarAvailable !== false);
    $('profileImageControls').hidden = false;
    $('profileMessage').textContent = !data.profile.avatarAvailable ? 'Profile images loaded. Your website avatar service is unavailable.' : data.profile.selectedAvatar && !data.profile.selectedAvatar.thumbnailUrl && !data.profile.avatarData ? 'Your selected website avatar has no preview image. You can choose a profile image here.' : 'Images are saved to your member account.';
  } catch (error) {
    if (current !== generation) return;
    $('profileScreen').hidden = false;
    $('profileMessage').textContent = error.message;
    if (error.status === 401 || error.status === 403) await refreshSession();
  } finally { if (current === generation) $('journeyBtn').disabled = false; }
}
async function saveProfileImage(field, image, current) {
  if (current !== generation || currentMember === null) return;
  const data = await request('PATCH', {[field]: image}, '/api/mobile/profile');
  if (current !== generation) return;
  savedProfile = data.profile; showProfileImages(data.profile);
  $('finishSetup').disabled = !hasProfileImage(savedProfile); $('saveProfile').disabled = !hasProfileImage(savedProfile);
  $('setupMessage').textContent = 'Profile image saved. Choose your skin, then continue.';
  $('profileMessage').textContent = 'Profile image saved to your account.';
}
async function chooseProfileImage(event, field) {
  const input = event.target, file = input.files?.[0];
  const selectedFor = imageSelections.get(input.id);
  imageSelections.delete(input.id); input.value = '';
  if (!file || busy || !Number.isSafeInteger(selectedFor)) return;
  // Native phone pickers may hide the page and clear its private profile.
  // Revalidate the session before attaching that selection to the same member.
  if (currentMember === null) await refreshSession();
  if (currentMember !== selectedFor) { status('Your account changed. Choose the image again for the current account.'); return; }
  if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { $('setupMessage').textContent = $('profileMessage').textContent = 'Choose a PNG, JPEG or WebP image under 10 MB.'; return; }
  const current = generation; busy = true;
  $('setupMessage').textContent = $('profileMessage').textContent = 'Preparing and saving your image…';
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    const max = field === 'bannerData' ? 1600 : 512;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(bitmap.width * scale)); canvas.height = Math.max(1,Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    let image = canvas.toDataURL('image/png');
    const limit = field === 'bannerData' ? 512 * 1024 : 256 * 1024;
    while (image.length > Math.floor(limit * 4 / 3) && Math.max(canvas.width,canvas.height) > 128) {
      canvas.width = Math.max(1,Math.round(canvas.width * 0.75)); canvas.height = Math.max(1,Math.round(canvas.height * 0.75));
      canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height); image = canvas.toDataURL('image/png');
    }
    await saveProfileImage(field,image,current);
  } catch (error) { if (current === generation) $('setupMessage').textContent = $('profileMessage').textContent = error.message || 'This image could not be saved. Try a smaller image.'; }
  finally { bitmap?.close(); busy = false; if (current !== generation && !document.hidden) refreshSession(); }
}
for (const [button,input] of [['chooseBanner','bannerFile'],['chooseBannerSurface','bannerFile'],['chooseAvatar','avatarFile'],['chooseAvatarSurface','avatarFile'],['chooseSetupAvatar','setupAvatarFile']]) {
  $(button).addEventListener('click', () => { if (!busy && currentMember !== null) $(input).click(); });
}
$('bannerFile').addEventListener('change', e => chooseProfileImage(e,'bannerData'));
$('avatarFile').addEventListener('change', e => chooseProfileImage(e,'avatarData'));
$('setupAvatarFile').addEventListener('change', e => chooseProfileImage(e,'avatarData'));
for (const id of ['bannerFile','avatarFile','setupAvatarFile']) {
  $(id).addEventListener('click', event => {
    if (busy || currentMember === null) { event.preventDefault(); return; }
    imageSelections.set(id,currentMember);
  });
}
for (const [id,field] of [['removeBanner','bannerData'],['removeAvatar','avatarData']]) {
  $(id).addEventListener('click', async () => {
    if (busy || currentMember === null) return;
    const current = generation; busy = true;
    try { await saveProfileImage(field,null,current); }
    catch (error) { if (current === generation) $('profileMessage').textContent = error.message; }
    finally { busy = false; if (current !== generation && !document.hidden) refreshSession(); }
  });
}

function hasProfileImage(profile) {
  return !!(profile?.avatarData || profile?.selectedAvatar?.thumbnailUrl);
}
function showAppearance(open) {
  $('appearanceSetup').hidden = !open; $('profileScreen').hidden = open;
  $('finishSetup').disabled = !hasProfileImage(savedProfile);
  if (open) $('setupMessage').textContent = hasProfileImage(savedProfile) ? 'Your saved profile image will be kept.' : 'Choose a profile image to continue.';
}
function applySkinChoice(value) {
  const skin = ['gold','dawn','neon'].includes(value) ? value : 'gold';
  $('skinChoice').value = skin; document.body.dataset.skin = skin;
  for (const [id,name] of [['profileSkinDawn','dawn'],['profileSkinNeon','neon'],['profileSkinGold','gold']]) $(id).setAttribute('aria-pressed',String(name === skin));
}
$('skinChoice').addEventListener('change', () => applySkinChoice($('skinChoice').value));
for (const [id,skin] of [['profileSkinDawn','dawn'],['profileSkinNeon','neon'],['profileSkinGold','gold']]) {
  $(id).addEventListener('click', () => { if (!busy && currentMember !== null) { applySkinChoice(skin); $('appearanceMessage').textContent = 'Choose Save Profile to keep this skin.'; } });
}
$('editAppearance').addEventListener('click', () => { if (!busy && currentMember !== null) showAppearance(true); });
async function saveAppearance() {
  if (busy || currentMember === null || !hasProfileImage(savedProfile)) return;
  const current = generation; busy = true; $('finishSetup').disabled = true; $('saveProfile').disabled = true;
  try {
    const data = await request('PATCH', {skin:$('skinChoice').value}, '/api/mobile/profile');
    if (current !== generation) return;
    savedProfile = data.profile; applySkinChoice(data.profile.skin);
    $('appearanceMessage').textContent = 'Profile saved.'; $('profileMessage').textContent = 'Profile saved to your member account.';
    showAppearance(false); $('welcome').focus();
  } catch (error) { if (current === generation) $('appearanceMessage').textContent = $('setupMessage').textContent = error.message; }
  finally { busy = false; if (current === generation) { $('finishSetup').disabled = !hasProfileImage(savedProfile); $('saveProfile').disabled = !hasProfileImage(savedProfile); } else if (!document.hidden) refreshSession(); }
}
$('finishSetup').addEventListener('click', saveAppearance);
$('saveProfile').addEventListener('click', saveAppearance);

function openWorldExplorer() {
  if (currentMember === null) return;
  $('profileScreen').hidden = true; $('explorer').hidden = false;
  $('worldList').replaceChildren();
  if (!Array.isArray(memberWorlds)) $('worldMessage').textContent = 'Your worlds could not be loaded. Return to your profile and recheck your session to retry.';
  else {
    $('worldMessage').textContent = memberWorlds.length ? 'Your saved worlds are listed below.' : 'No saved worlds were found for this account yet.';
    for (const world of memberWorlds) {
      const card = document.createElement('div'); card.className = 'glass mc-row';
      const title = document.createElement('strong'); title.textContent = world.name;
      const detail = document.createElement('span'); detail.textContent = world.visibility+' · '+world.status;
      const actions = document.createElement('div'); actions.className = 'world-toolbar';
      const open = document.createElement('a'); open.className = 'mini-btn'; open.textContent = 'OPEN 3D WORLD'; open.href = 'https://troothhurtz.app/worlds/'+encodeURIComponent(world.id);
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'mini-btn'; edit.textContent = 'EDIT & SAVE MY WORLD'; edit.addEventListener('click',()=>openMobileWorld(world.id));
      actions.append(open,edit); card.append(title,detail,actions); $('worldList').append(card);
    }
  }
  $('explorerHeading').focus();
}
$('journeyBtn').addEventListener('click', openWorldExplorer);
$('workspaceJourney').addEventListener('click', openWorldExplorer);
$('explorerBack').addEventListener('click', () => { if (worldDirty && !confirm('Leave unsaved world changes?')) return; $('explorer').hidden = true; $('profileScreen').hidden = false; $('journeyBtn').focus(); });
$('loginForm').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  busy = true; ++generation; imageSelections.clear(); clearAccount(); $('loginButton').disabled = true;
  const password = $('password').value; $('password').value = '';
  status('Signing in…');
  try { await request('POST', {identifier: $('identifier').value.trim(), password, accountType: $('accountType')?.value || 'member'}); await refreshSession(); }
  catch (error) { status(error.name === 'AbortError' ? 'Sign-in timed out. Please retry.' : error.message); }
  finally { busy = false; $('loginButton').disabled = false; }
});
async function signOut() {
  if (busy) return; busy = true; ++generation; imageSelections.clear(); clearAccount();
  try { await request('DELETE'); $('signin').hidden = false; status('Signed out of this mobile app. Website sessions are unchanged.'); }
  catch { $('signin').hidden = true; status('Sign-out could not be confirmed. Reconnect and retry.'); }
  finally { busy = false; }
}
$('logout').addEventListener('click', signOut);
$('declineTerms').addEventListener('click', signOut);
$('termsAccepted').addEventListener('change', () => { $('acceptTerms').disabled = busy || !pendingTerms || !$('termsAccepted').checked; });
$('termsForm').addEventListener('submit', async event => {
  event.preventDefault(); if (busy || !pendingTerms || !$('termsAccepted').checked) return;
  const snapshot = {...pendingTerms}; const current = ++generation;
  busy = true; $('acceptTerms').disabled = true; status('Saving your acceptance…');
  try {
    await request('POST', {accepted: true, ...snapshot}, '/api/mobile/terms');
    if (current !== generation) return;
    await refreshSession();
  } catch (error) {
    if (current !== generation) return;
    if (error.status === 409) await refreshSession();
    else status(error.name === 'AbortError' ? 'Acceptance could not be confirmed. Please retry.' : error.message);
  } finally { busy = false; $('acceptTerms').disabled = !pendingTerms || !$('termsAccepted').checked; }
});
$('retry').addEventListener('click', () => { if (!busy) refreshSession(); });
window.addEventListener('pagehide', () => { ++generation; clearAccount(); $('password').value = ''; });
window.addEventListener('pageshow', () => { if (!busy) refreshSession(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { ++generation; clearAccount(); }
  else if (!busy) refreshSession();
});
let installPrompt;
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('install').hidden = false; });
$('install').addEventListener('click', async () => {
  if (!installPrompt) return; await installPrompt.prompt(); await installPrompt.userChoice;
  installPrompt = null; $('install').hidden = true;
});
window.addEventListener('appinstalled', () => { $('install').hidden = true; $('installHelp').textContent = 'App installed. Account features require an internet connection.'; });
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/smart-trust-mobile-sw.js', {scope:'/mobile', updateViaCache:'none'}).then(reg => {
    const offer = () => { if (reg.waiting) $('update').hidden = false; };
    offer(); reg.addEventListener('updatefound', () => { reg.installing?.addEventListener('statechange', offer); });
    $('update').addEventListener('click', () => { if (reg.waiting) reg.waiting.postMessage({type:'ACTIVATE_UPDATE'}); else location.reload(); });
    reg.update().catch(() => {});
  }).catch(() => { $('installHelp').textContent += ' Browser install support is unavailable; the website link still works.'; });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading && !$('update').hidden) { reloading = true; location.reload(); } });
}
refreshSession();






function worldMessage(text) { $('worldSaveMessage').textContent = text; }
function setWorldBusy(value) {
  worldWriting = value;
  for (const id of ['saveWorld','publishWorld','saveWorldAccess','addPlacement','reloadWorld','worldVisibility','ownedAsset']) $(id).disabled = value;
  for (const input of $('placementList').querySelectorAll('input,button')) input.disabled = value;
}
function showWorld(data) {
  activeWorld = data; worldDirty = false;
  $('worldEditor').hidden = false; $('worldEditorHeading').textContent = data.world.name;
  $('worldAddress').value = data.world.shareUrl;
  $('worldVisibility').value = data.world.visibility;
  $('worldEditorNote').textContent = 'Positions are in world units; rotations are in radians. Save stores your private draft. Visitors see the last published version when visitor access allows it.';
  $('ownedAsset').replaceChildren();
  for (const asset of data.assets) {const option=document.createElement('option');option.value=asset.id;option.textContent=asset.name;$('ownedAsset').append(option);}
  renderPlacements();
}
function renderPlacements() {
  $('placementList').replaceChildren();
  for (const placement of activeWorld.placements) {
    const card = document.createElement('article'); card.className='placement-card';
    const title=document.createElement('h3');title.textContent=activeWorld.assets.find(a=>a.id===placement.assetId)?.name || 'Saved asset';card.append(title);
    for (const field of ['position','rotation','scale']) {
      const group=document.createElement('div');group.className='placement-fields';
      for (const [axis,index] of [['X',0],['Y',1],['Z',2]]) {
        const label=document.createElement('label');label.textContent=field+' '+axis;
        const input=document.createElement('input');input.type='number';input.step='any';input.value=placement[field]?.[index] ?? (field==='scale'?1:0);input.required=true;
        input.addEventListener('input',()=>{placement[field] ??= field==='scale'?[1,1,1]:[0,0,0];placement[field][index]=input.value.trim()===''?null:Number(input.value);worldDirty=true;worldMessage('Unsaved world changes.');});
        label.append(input);group.append(label);
      }
      card.append(group);
    }
    const remove=document.createElement('button');remove.className='mini-btn';remove.type='button';remove.textContent='REMOVE PLACEMENT';remove.addEventListener('click',()=>{activeWorld.placements=activeWorld.placements.filter(p=>p.id!==placement.id);worldDirty=true;renderPlacements();worldMessage('Unsaved world changes.');});card.append(remove);$('placementList').append(card);
  }
}
async function openMobileWorld(id) {
  if (worldWriting || (worldDirty && !confirm('Discard unsaved world changes and reload?'))) return;
  const current=generation;const member=currentMember;
  worldMessage('Loading your saved world…');$('worldEditor').hidden=false;setWorldBusy(true);
  try {const data=await request('GET',undefined,'/api/mobile/worlds/'+encodeURIComponent(id));if(current!==generation || member!==currentMember)return;showWorld(data);worldMessage('Saved world loaded from your account.');$('worldEditorHeading').focus();}
  catch(error){if(current===generation){worldMessage(error.message);$('worldMessage').textContent=error.message;}}
  finally {if(current===generation)setWorldBusy(false);else worldWriting=false;}
}
async function writeMobileWorld(action) {
  if (!activeWorld || worldWriting) return false;
  const current=generation;const member=currentMember;const id=activeWorld.world.id;setWorldBusy(true);
  try {
    const body={action,revision:activeWorld.revision};
    if(action==='save')body.placements=structuredClone(activeWorld.placements);
    if(action==='visibility')body.visibility=$('worldVisibility').value;
    const data=await request('POST',body,'/api/mobile/worlds/'+encodeURIComponent(id));
    if(current!==generation || member!==currentMember)return false;
    if(!data.saved)throw new Error('The save was not confirmed. Please retry.');
    showWorld(data);
    const row=memberWorlds?.find(w=>w.id===id);if(row)Object.assign(row,{status:data.world.status,visibility:data.world.visibility});
    worldMessage(action==='publish'?'Saved world published. Visitor access follows your selected setting.':action==='visibility'?'Visitor access saved.':'My world saved to my account.');
    return true;
  } catch(error){if(current===generation)worldMessage(error.message);return false;}
  finally {if(current===generation)setWorldBusy(false);else worldWriting=false;}
}
$('saveWorld').addEventListener('click',()=>writeMobileWorld('save'));
$('publishWorld').addEventListener('click',async()=>{if(!activeWorld||worldWriting)return;if(worldDirty && !await writeMobileWorld('save'))return;await writeMobileWorld('publish');});
$('saveWorldAccess').addEventListener('click',async()=>{if(!activeWorld||worldWriting)return;const visibility=$('worldVisibility').value;if(worldDirty && !await writeMobileWorld('save'))return;$('worldVisibility').value=visibility;await writeMobileWorld('visibility');});
$('reloadWorld').addEventListener('click',()=>{if(activeWorld)openMobileWorld(activeWorld.world.id);});
$('addPlacement').addEventListener('click',()=>{
  if(!activeWorld || worldWriting || !$('ownedAsset').value)return;
  activeWorld.placements.push({id:crypto.randomUUID(),assetId:$('ownedAsset').value,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],ownerLayer:'user'});
  worldDirty=true;renderPlacements();worldMessage('New asset placement added at the origin. Set its position, then Save My World.');
});
$('copyWorldAddress').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('worldAddress').value);worldMessage('World address copied. Private worlds still require access.');}catch{$('worldAddress').focus();$('worldAddress').select();worldMessage('Select and copy the world address above.');}});
window.addEventListener('beforeunload',event=>{if(worldDirty||worldWriting){event.preventDefault();event.returnValue='';}});

