// Firebase Messaging Service Worker - Volei Tche
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCZT3V47oJmLNemruMRjBQIbse2qzSKZPM",
  authDomain: "volei-tche.firebaseapp.com",
  projectId: "volei-tche",
  storageBucket: "volei-tche.firebasestorage.app",
  messagingSenderId: "225022526355",
  appId: "1:225022526355:web:066e5a75388c7b1c045e66"
});

const messaging = firebase.messaging();

const BASE_URL = 'https://andersonveloso0503-cmyk.github.io/volei-tche/';

// Notificação recebida com app em BACKGROUND
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Mensagem em background:', payload);
  const { title, body } = payload.notification || {};
  const url = payload.fcmOptions?.link || payload.data?.url || BASE_URL;

  self.registration.showNotification(title || '🏐 Volei Tche', {
    body: body || 'Nova notificação',
    icon: '/volei-tche/logo192.png',
    badge: '/volei-tche/logo192.png',
    data: { url },
    requireInteraction: true,
    vibrate: [200, 100, 200]
  });
});

// Clique na notificação → abre direto na página correta
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || BASE_URL;
  console.log('[SW] Clique na notificação, abrindo:', url);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Se o app já está aberto, navega para a URL correta
      for (const client of list) {
        if (client.url.includes('volei-tche') && 'navigate' in client) {
          client.focus();
          return client.navigate(url);
        }
      }
      // Se não está aberto, abre uma nova janela com a URL correta
      return clients.openWindow(url);
    })
  );
});
