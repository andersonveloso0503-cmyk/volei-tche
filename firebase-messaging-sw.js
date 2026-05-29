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

// ── Notificação recebida em BACKGROUND ──────────────────────
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message:', payload);

  const { title, body } = payload.notification || {};
  const url    = payload.fcmOptions?.link || payload.data?.url || BASE_URL;
  const jogoId = payload.data?.jogoId || '';
  const nome   = payload.data?.nome   || '';

  // Se for notificação de convocação, adiciona botões de confirmação
  const isConvocacao = jogoId && nome;

  const options = {
    body:  body || 'Nova notificação',
    icon:  '/volei-tche/logo192.png',
    badge: '/volei-tche/logo192.png',
    data:  { url, jogoId, nome },
    requireInteraction: true,
    vibrate: [200, 100, 200],
    tag: jogoId || 'volei-tche',  // agrupa notificações do mesmo jogo
  };

  // Botões de ação (funciona no Android Chrome)
  if (isConvocacao) {
    options.actions = [
      { action: 'confirmar', title: '✅ Bora lá!' },
      { action: 'recusar',   title: '❌ Não posso' },
    ];
  }

  self.registration.showNotification(title || '🏐 Volei Tche', options);

  // Atualiza badge no ícone do app
  if ('setAppBadge' in navigator) {
    navigator.setAppBadge().catch(() => {});
  }
});

// ── Clique na notificação ou nos botões ─────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { url, jogoId, nome } = event.notification.data || {};
  const action = event.action;

  console.log('[SW] Clique:', action, '| jogo:', jogoId, '| jogador:', nome);
  
  // Limpa o badge ao interagir com a notificação
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }

  // Se clicou em "Bora lá!" ou "Não posso"
  if ((action === 'confirmar' || action === 'recusar') && jogoId && nome) {
    const resposta = action === 'confirmar' ? 'sim' : 'nao';

    // Salva a confirmação no Firestore via fetch para Cloud Function
    event.waitUntil(
      fetch('https://us-east1-volei-tche.cloudfunctions.net/confirmarPresenca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jogoId, nome, resposta }),
      }).then(resp => {
        console.log('[SW] Confirmação salva:', resposta, resp.status);
        // Mostra notificação de feedback
        return self.registration.showNotification(
          action === 'confirmar' ? '✅ Presença confirmada!' : '❌ Ausência registrada',
          {
            body: action === 'confirmar'
              ? `${nome}, te vemos em campo! 🏐`
              : `${nome}, tudo bem! Até a próxima.`,
            icon: '/volei-tche/logo192.png',
            tag: 'feedback-' + jogoId,
            requireInteraction: false,
          }
        );
      }).catch(err => {
        console.error('[SW] Erro ao confirmar:', err);
        // Fallback: abre o app
        return clients.openWindow(url || BASE_URL + '?jogo=' + jogoId);
      })
    );
    return;
  }

  // Clique normal na notificação → abre o app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('volei-tche') && 'navigate' in client) {
          client.focus();
          return client.navigate(url || BASE_URL);
        }
      }
      return clients.openWindow(url || BASE_URL);
    })
  );
});
