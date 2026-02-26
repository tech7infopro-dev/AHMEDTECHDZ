// ============================================
// ENVIRONMENT VARIABLES INJECTION - SECURITY HARDENED v4
// ============================================

(function() {
    'use strict';
    
    window.ENV = window.ENV || {};
    window.process = window.process || {};
    window.process.env = window.process.env || {};
    
    const envVars = [
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
    
    function isValidValue(content) {
        if (!content || typeof content !== 'string') return false;
        if (content.startsWith('%') && content.endsWith('%')) return false;
        if (content.includes('%NEXT_PUBLIC_')) return false;
        if (content.length < 10) return false;
        
        const invalidPatterns = ['your-', 'undefined', 'null', '[object'];
        const lower = content.toLowerCase();
        for (const p of invalidPatterns) {
            if (lower.includes(p)) return false;
        }
        return true;
    }
    
    let loadedCount = 0;
    const missingVars = [];
    
    envVars.forEach(varName => {
        const meta = document.querySelector(`meta[name="${varName}"]`);
        if (meta) {
            const content = meta.getAttribute('content');
            if (isValidValue(content)) {
                window.ENV[varName] = content;
                window.process.env[varName] = content;
                loadedCount++;
            } else {
                missingVars.push(varName);
            }
        } else {
            missingVars.push(varName);
        }
    });
    
    const criticalVars = ['NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'];
    const missingCritical = criticalVars.filter(v => !window.ENV[v]);
    
    window.ENV_LOADED = missingCritical.length === 0;
    window.ENV_STATUS = {
        loaded: loadedCount,
        total: envVars.length,
        missing: missingVars,
        criticalMissing: missingCritical,
        timestamp: new Date().toISOString()
    };
    
    // ✅ NO console.log here - completely silent
    
    window.dispatchEvent(new CustomEvent('env-loaded', {
        detail: window.ENV_STATUS
    }));
    
    window.getEnvStatus = function() { return window.ENV_STATUS; };
    window.getEnv = function(key, defaultValue) { 
        return window.ENV[key] || window.process.env[key] || defaultValue; 
    };
})();


