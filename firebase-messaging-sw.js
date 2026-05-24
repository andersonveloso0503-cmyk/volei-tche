importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCZT3V47oJmLNemruMRjBQIbse2qzSKZPM",
  authDomain: "volei-tche.firebaseapp.com",
  projectId: "volei-tche",
  storageBucket: "volei-tche.firebasestorage.app",
  messagingSenderId: "225022526355",
  appId: "1:225022526355:web:066e5a75388c7b1c045e66"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: icon || '/logo192.png',
    badge: '/logo192.png',
    vibrate: [200, 100, 200],
  });
});
