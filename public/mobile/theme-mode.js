// Only a non-sensitive display preference is stored here; no account or image data.
const key = 'smart-trust-mobile-view-mode';
function applyViewMode(value) {
  const mode = value === 'night' ? 'night' : 'day';
  document.body.dataset.viewMode = mode;
  for (const id of ['profileViewMode','appearanceViewMode']) {
    const button = document.getElementById(id);
    button.textContent = mode === 'night' ? 'NIGHT' : 'DAY';
    button.setAttribute('aria-checked', String(mode === 'night'));
  }
}
let saved = 'day';
try { saved = localStorage.getItem(key); } catch { /* Storage can be unavailable. */ }
applyViewMode(saved);
for (const id of ['profileViewMode','appearanceViewMode']) {
  document.getElementById(id).addEventListener('click', () => {
    const mode = document.body.dataset.viewMode === 'night' ? 'day' : 'night';
    applyViewMode(mode);
    try { localStorage.setItem(key, mode); } catch { /* Display still changes for this page. */ }
  });
}
