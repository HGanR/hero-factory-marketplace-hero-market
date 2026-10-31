const $ = id => document.getElementById(id);
let generation = 0;
let busy = false;
let pendingTerms = null;
let memberWorlds = null;
let currentMember = null;
let savedProfile = null;
const imageSelections = new Map();
function clearAccount() {
  $('account').hidden = true;
  currentMember = null; memberWorlds = null; savedProfile = null;
  $('appearanceSetup').hidden = true; $('finishSetup').disabled = true; $('editAppearance').hidden = true;
  $('setupUsername').textContent = ''; $('setupMessage').textContent = '';
  $('skinChoice').value = 'gold'; document.body.dataset.skin = 'gold';
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
    $('welcome').textContent = 'WELCOME, ' + user.username;
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
    $('skinChoice').value = ['gold','dawn','neon'].includes(data.profile.skin) ? data.profile.skin : 'gold';
    document.body.dataset.skin = $('skinChoice').value;
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
  $('finishSetup').disabled = !hasProfileImage(savedProfile);
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
for (const [button,input] of [['chooseBanner','bannerFile'],['chooseAvatar','avatarFile'],['chooseSetupAvatar','setupAvatarFile']]) {
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
$('skinChoice').addEventListener('change', () => {
  document.body.dataset.skin = ['gold','dawn','neon'].includes($('skinChoice').value) ? $('skinChoice').value : 'gold';
});
$('editAppearance').addEventListener('click', () => { if (!busy && currentMember !== null) showAppearance(true); });
$('finishSetup').addEventListener('click', async () => {
  if (busy || currentMember === null || !hasProfileImage(savedProfile)) return;
  const current = generation; busy = true; $('finishSetup').disabled = true;
  try {
    const data = await request('PATCH', {skin:$('skinChoice').value}, '/api/mobile/profile');
    if (current !== generation) return;
    savedProfile = data.profile; document.body.dataset.skin = data.profile.skin;
    showAppearance(false); $('welcome').focus();
  } catch (error) { if (current === generation) $('setupMessage').textContent = error.message; }
  finally { busy = false; if (current === generation) $('finishSetup').disabled = !hasProfileImage(savedProfile); else if (!document.hidden) refreshSession(); }
});

$('journeyBtn').addEventListener('click', () => {
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
      card.append(title,detail); $('worldList').append(card);
    }
  }
  $('explorerHeading').focus();
});
$('explorerBack').addEventListener('click', () => { $('explorer').hidden = true; $('profileScreen').hidden = false; $('journeyBtn').focus(); });
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




