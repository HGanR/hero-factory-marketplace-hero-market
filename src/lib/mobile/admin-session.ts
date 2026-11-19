/** Reuse the website's administrator authority; never copy its password/signing key. */
const website = 'https://troothhurtz.app';
const maxBytes = 8192;
export const mobileAdminCookie = '__Host-smart-trust-mobile-admin';
export type MobileAdministrator = { role: 'administrator'; username: string };
export type AdminResult = { ok: true; user: MobileAdministrator } | { ok: false; status: 401 | 503 };

async function readJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error('Missing response');
  const reader = response.body.getReader(); const decoder = new TextDecoder();
  let text = ''; let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw new Error('Response too large');
      text += decoder.decode(chunk.value, {stream: true});
    }
    return JSON.parse(text + decoder.decode());
  } finally { await reader.cancel().catch(() => {}); }
}
function options(): RequestInit {
  return {cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000)};
}
function validToken(token: string): boolean {
  return token.length <= 3072 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
}
export async function checkMobileAdministrator(token: string, send: typeof fetch = fetch): Promise<AdminResult> {
  if (!validToken(token)) return {ok: false, status: 401};
  try {
    const response = await send(website+'/api/admin/check', {
      ...options(), headers: {Cookie: 'admin-token='+token, Accept: 'application/json'},
    });
    if (!response.ok) { await response.body?.cancel(); return {ok: false, status: response.status === 401 || response.status === 403 ? 401 : 503}; }
    const body = await readJson(response) as {isAdmin?: unknown; username?: unknown};
    if (body?.isAdmin !== true || typeof body.username !== 'string' || !body.username.trim() || body.username.length > 100) return {ok: false, status: 401};
    return {ok: true, user: {role: 'administrator', username: body.username}};
  } catch { return {ok: false, status: 503}; }
}
export async function signInMobileAdministrator(
  identifier: string, password: string, send: typeof fetch = fetch,
): Promise<AdminResult & {token?: string}> {
  try {
    const response = await send(website+'/api/admin/login-edge', {
      ...options(), method: 'POST', headers: {'Content-Type': 'application/json', Origin: website},
      body: JSON.stringify({username: identifier, password}),
    });
    if (!response.ok) { await response.body?.cancel(); return {ok: false, status: response.status === 401 || response.status === 403 ? 401 : 503}; }
    const cookies = response.headers.getSetCookie();
    const token = cookies.map(cookie => /^admin-token=([^;,\s]+)/.exec(cookie)?.[1]).find(Boolean);
    // The login body is not an authority assertion. Verify the issued cookie independently.
    await response.body?.cancel();
    if (!token || !validToken(token)) return {ok: false, status: 503};
    const verified = await checkMobileAdministrator(token, send);
    return verified.ok ? {...verified, token} : verified;
  } catch { return {ok: false, status: 503}; }
}
