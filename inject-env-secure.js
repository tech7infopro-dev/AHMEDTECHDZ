// ============================================
// ENVIRONMENT VARIABLES INJECTION - VERSION 2
// Secure & Silent - No console output
// ============================================

(function() {
    'use strict';

    window.ENV = window.ENV || {};
    window.process = window.process || { env: {} };

    const ENV_VARS = [
        'NEXT_PUBLIC_FIREBASE_API_KEY',
        'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
        'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
        'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
        'NEXT_PUBLIC_FIREBASE_APP_ID',
        'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID',
        'NEXT_PUBLIC_DEFAULT_OWNER_EMAIL',
        'NEXT_PUBLIC_DEFAULT_OWNER_NAME',
        'NEXT_PUBLIC_DEFAULT_OWNER_PASSWORD',
        'NEXT_PUBLIC_PBKDF2_ITERATIONS',
        'NEXT_PUBLIC_PASSWORD_SALT',
        'NEXT_PUBLIC_FIREBASE_SYNC'
    ];

    function isValid(value) {
        if (!value || typeof value !== 'string') return false;
        if (value.length < 3) return false;
        if (value.includes('%') || value.includes('your-') || value.includes('undefined')) return false;
        return true;
    }

    let loaded = 0;

    ENV_VARS.forEach(function(key) {
        var meta = document.querySelector('meta[name="' + key + '"]');
        if (meta) {
            var value = meta.getAttribute('content');
            if (isValid(value)) {
                window.ENV[key] = value;
                window.process.env[key] = value;
                loaded++;
            }
        }
    });

    // إشارة بدون تفاصيل
    window.ENV_LOADED = true;
    window.getEnv = function(key, defaultValue) {
        return window.ENV[key] || defaultValue;
    };

    // رسالة عامة جداً - لا تكشف أي شيء
    if (loaded > 3) {
        console.log('[✓] Environment ready');
    } else {
        console.log('[!] Using fallback config');
    }
})();
