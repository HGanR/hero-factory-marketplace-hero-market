// Mobile registration and PayPal attribution release 2026-11-10.
// Intentionally no fetch handler/cache: never store account pages or API responses.
self.addEventListener('install', () => {});
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});



