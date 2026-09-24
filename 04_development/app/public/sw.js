/**
 * ClaudeManager Service Worker — handles push notifications.
 */

/* eslint-disable no-restricted-globals */

/** notificationclick의 이동 대상 URL 판정 (DES-007 §6) — url 없으면 '/m/chat'. */
function resolveNotificationTargetUrl(data) {
  return (data && data.url) || '/m/chat';
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'ClaudeManager', body: event.data.text() };
  }

  const title = data.title || 'ClaudeManager';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: data.tag || 'claudemanager-notification',
    data: {
      url: resolveNotificationTargetUrl(data),
    },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = resolveNotificationTargetUrl(event.notification.data);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow(targetUrl);
    })
  );
});

// 테스트 전용 export — 브라우저 SW 컨텍스트에는 `module`이 없으므로 `typeof` 가드로 안전하게 no-op된다.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { resolveNotificationTargetUrl };
}
