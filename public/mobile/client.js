const $ = id => document.getElementById(id);
let generation = 0;
let busy = false;
function clearAccount() {
  $('account').hidden = true;
  for (const id of ['username', 'email', 'memberId', 'wallet', 'welcome']) $(id).textContent = '';
}
function status(message) { $('status').textContent = message; }
async function request(method = 'GET', body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch('/api/mobile/session', {method, credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      headers: body ? {'Content-Type':'application/json'} : {}, body: body ? JSON.stringify(body) : undefined});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Account service unavailable (' + response.status + ').');
    return data;
  } finally { clearTimeout(timer); }
}
async function refreshSession() {
  const current = ++generation;
  clearAccount(); $('signin').hidden = true; status('Checking your website session…');
  try {
    const {user} = await request();
    if (current !== generation) return;
    if (!user || !Number.isSafeInteger(user.id) || user.id < 1 || typeof user.username !== 'string' || typeof user.email !== 'string') throw new Error('Account service returned an invalid profile.');
    $('welcome').textContent = 'WELCOME, ' + user.username;
    $('username').textContent = 'Username: ' + user.username;
    $('email').textContent = 'Email: ' + user.email;
    $('memberId').textContent = 'Account ID: ' + user.id;
    $('wallet').textContent = user.walletAddress ? 'Saved wallet: ' + user.walletAddress : 'No wallet address saved.';
    $('account').hidden = false; status('Website session confirmed.');
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
  try { await request('POST', {identifier: $('identifier').value.trim(), password}); await refreshSession(); }
  catch (error) { status(error.name === 'AbortError' ? 'Sign-in timed out. Please retry.' : error.message); }
  finally { busy = false; $('loginButton').disabled = false; }
});
$('logout').addEventListener('click', async () => {
  if (busy) return; busy = true; ++generation; clearAccount();
  try { await request('DELETE'); $('signin').hidden = false; status('Signed out of the website member session in this browser.'); }
  catch { $('signin').hidden = true; status('Sign-out could not be confirmed. Reconnect and retry.'); }
  finally { busy = false; }
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
