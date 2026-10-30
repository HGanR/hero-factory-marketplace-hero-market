const $ = id => document.getElementById(id);
let generation = 0;
let busy = false;
let pendingTerms = null;
function clearAccount() {
  $('account').hidden = true;
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
    $('account').hidden = false; status(administrator ? 'Website administrator session confirmed.' : 'Website session confirmed.');
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
$('loginForm').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  busy = true; ++generation; clearAccount(); $('loginButton').disabled = true;
  const password = $('password').value; $('password').value = '';
  status('Signing in…');
  try { await request('POST', {identifier: $('identifier').value.trim(), password, accountType: $('accountType')?.value || 'member'}); await refreshSession(); }
  catch (error) { status(error.name === 'AbortError' ? 'Sign-in timed out. Please retry.' : error.message); }
  finally { busy = false; $('loginButton').disabled = false; }
});
async function signOut() {
  if (busy) return; busy = true; ++generation; clearAccount();
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

