// ============================================
// SERVICE WORKER - PWA - SECURE VERSION
// ============================================

const CACHE_NAME = 'ahmedtech-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/config.js',
  '/inject-env.js'
];

// تثبيت
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// تفعيل
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// جلب البيانات - معدل للسماح بـ CDN
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // ✅ السماح بـ Font Awesome وكل الـ CDNs
  if (url.hostname.includes('cdnjs.cloudflare.com') ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    // لا تتدخل في طلبات CDN
    return;
  }
  
  // تخطي Firebase
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis.com')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});


