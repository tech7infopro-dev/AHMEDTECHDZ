// ============================================
// ENVIRONMENT VARIABLES INJECTION - SECURE VERSION
// No Console Logging of Sensitive Data
// ============================================

(function() {
    'use strict';
    
    // 🚫 NO DEBUG MODE - Never log sensitive values
    const SILENT_MODE = true;
    
    // Create global ENV object
    window.ENV = window.ENV || {};
    window.process = window.process || {};
    window.process.env = window.process.env || {};
    
    // All required environment variables
    const envVarNames = [
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
    
    // Try to get from window.__ENV__ (injected by build.js)
    let source = 'fallback';
    let loadedCount = 0;
    
    if (typeof window.__ENV__ !== 'undefined') {
        // Use injected environment variables
        envVarNames.forEach(varName => {
            if (window.__ENV__[varName]) {
                window.ENV[varName] = window.__ENV__[varName];
                window.process.env[varName] = window.__ENV__[varName];
                loadedCount++;
            }
        });
        source = 'injected';
    } else {
        // Fallback: try to read from meta tags (legacy support)
        envVarNames.forEach(varName => {
            const meta = document.querySelector(`meta[name="${varName}"]`);
            if (meta && meta.content) {
                const content = meta.content;
                // Skip placeholders
                if (!content.includes('%') && !content.includes('your-') && content.length > 3) {
                    window.ENV[varName] = content;
                    window.process.env[varName] = content;
                    loadedCount++;
                }
            }
        });
        source = 'meta';
    }
    
    // Mark as loaded (no details to avoid leaking info)
    window.ENV_LOADED = true;
    window.ENV_STATUS = {
        loaded: loadedCount > 0,
        source: source
    };
    
    // Silent helper function
    window.getEnv = function(key, defaultValue = null) {
        return window.ENV[key] || window.process.env[key] || defaultValue;
    };
    
    // 🛡️ Security: Prevent enumeration of ENV object
    if (Object.defineProperty) {
        Object.defineProperty(window, 'ENV', {
            enumerable: false,
            configurable: false
        });
        Object.defineProperty(window.process, 'env', {
            enumerable: false,
            configurable: false
        });
    }
    
    // 🗑️ Self-destruct: Remove this script tag to hide source
    try {
        const currentScript = document.currentScript;
        if (currentScript && currentScript.parentNode) {
            setTimeout(() => {
                currentScript.parentNode.removeChild(currentScript);
            }, 0);
        }
        
        // Also remove window.__ENV__ after reading
        if (typeof window.__ENV__ !== 'undefined') {
            setTimeout(() => {
                delete window.__ENV__;
            }, 100);
        }
    } catch (e) {
        // Silent fail
    }
    
    // ✅ Only log non-sensitive status
    if (!SILENT_MODE) {
        console.log('[EnvInject] Environment loaded');
    }
})();


