importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDQlVfrNtVs3QfEx0VE9ffKPDL3KuOiG9M",
  authDomain: "track-asst.firebaseapp.com",
  projectId: "track-asst",
  storageBucket: "track-asst.firebasestorage.app",
  messagingSenderId: "909479175344",
  appId: "1:909479175344:web:9792811ce5f2740e044775"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || '新通知';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
