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

// Notificação recebida com app em BACKGROUND
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Mensagem em background:', payload);
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || '🏐 Volei Tche', {
    body: body || 'Nova notificação',
    icon: icon || '/volei-tche/logo192.png',
    badge: '/volei-tche/logo192.png',
    data: payload.data || {},
    actions: [
      { action: 'abrir', title: 'Abrir app' },
      { action: 'fechar', title: 'Fechar' }
    ],
    vibrate: [200, 100, 200]
  });
});

// Clique na notificação → abre o app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'fechar') return;
  const url = event.notification.data?.url || 'https://andersonveloso0503-cmyk.github.io/volei-tche/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes('volei-tche'));
      if (existing) { existing.focus(); existing.navigate(url); }
      else clients.openWindow(url);
    })
  );
});
