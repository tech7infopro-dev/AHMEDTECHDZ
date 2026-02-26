// ============================================
// ENVIRONMENT VARIABLES INJECTION - SECURE VERSION
// Reads from window.ENV (set by build.js) instead of meta tags
// ============================================

(function() {
    'use strict';

    console.log('[EnvInject] Starting secure injection...');

    // Wait for window.ENV to be available (set by build.js)
    function waitForEnv() {
        return new Promise((resolve) => {
            if (typeof window.ENV !== 'undefined' && window.ENV_LOADED) {
                console.log('[EnvInject] Environment variables already available');
                resolve();
                return;
            }

            window.addEventListener('env-loaded', () => resolve(), { once: true });

            // Fallback: check every 100ms for 5 seconds
            let attempts = 0;
            const interval = setInterval(() => {
                attempts++;
                if (typeof window.ENV !== 'undefined' && window.ENV_LOADED) {
                    clearInterval(interval);
                    resolve();
                } else if (attempts > 50) {
                    clearInterval(interval);
                    console.warn('[EnvInject] Timeout - using fallback');
                    resolve();
                }
            }, 100);
        });
    }

    // Initialize
    waitForEnv().then(() => {
        console.log('[EnvInject] ✅ Environment ready');
        console.log('[EnvInject] Variables loaded:', Object.keys(window.ENV || {}).length);

        // Verify critical variables
        const criticalVars = [
            'NEXT_PUBLIC_FIREBASE_API_KEY',
            'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
            'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
        ];

        const missing = criticalVars.filter(v => !window.ENV[v] || window.ENV[v] === '');

        if (missing.length > 0) {
            console.warn('[EnvInject] ⚠️ Missing critical variables:', missing.join(', '));
        } else {
            console.log('[EnvInject] ✅ All critical variables present');
        }
    });

    // Expose helper globally
    window.getEnvStatus = function() {
        return {
            loaded: window.ENV_LOADED || false,
            variables: Object.keys(window.ENV || {}),
            hasFirebase: !!(window.ENV && window.ENV.NEXT_PUBLIC_FIREBASE_API_KEY)
        };
    };
})();
