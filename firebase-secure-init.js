// ============================================
// FIREBASE SECURE INITIALIZATION
// يمنع Firebase من طباعة التكوين في Console
// ============================================

(function() {
    'use strict';

    // الانتظار حتى تحميل Firebase SDK
    function initFirebase() {
        if (typeof firebase === 'undefined') {
            setTimeout(initFirebase, 100);
            return;
        }

        // الحصول على التكوين من ENV
        var config = {
            apiKey: window.getEnv('NEXT_PUBLIC_FIREBASE_API_KEY'),
            authDomain: window.getEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
            projectId: window.getEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
            storageBucket: window.getEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
            messagingSenderId: window.getEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
            appId: window.getEnv('NEXT_PUBLIC_FIREBASE_APP_ID'),
            measurementId: window.getEnv('NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID')
        };

        // التحقق من وجود التكوين
        if (!config.apiKey || config.apiKey === 'YOUR_FIREBASE_API_KEY_HERE') {
            console.warn('[Firebase] Using default config - sync may not work');
            return;
        }

        // تعطيل console.log مؤقتاً أثناء التهيئة
        var originalLog = console.log;
        console.log = function() {};

        try {
            // تهيئة Firebase
            firebase.initializeApp(config);

            // تفعيل Firestore
            if (firebase.firestore) {
                firebase.firestore();
            }

            console.log = originalLog;
            console.log('[✓] Firebase connected');

        } catch (e) {
            console.log = originalLog;
            console.error('[Firebase] Init error:', e.message);
        }
    }

    // بدء التهيئة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFirebase);
    } else {
        initFirebase();
    }
})();
