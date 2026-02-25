// ============================================
// ENVIRONMENT VARIABLES INJECTION - SECURE VERSION v2
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
    
    // ✅ FIXED: تحسين التحقق من القيم
    function isValidValue(content) {
        if (!content || typeof content !== 'string') return false;
        
        // ✅ رفض القيم الواضحة أنها placeholders
        const isPlaceholder = 
            content.includes('%NEXT_PUBLIC_') ||           // %NEXT_PUBLIC_API_KEY%
            content.startsWith('%') && content.endsWith('%') || // %...%
            content.includes('your-') ||
            content.includes('YOUR_') ||
            content === 'undefined' ||
            content === 'null' ||
            content === '[object Object]' ||
            content === '' ||
            content.length < 3;
        
        if (isPlaceholder) return false;
        
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
                console.log(`[EnvInject] ✅ Loaded: ${varName}`);
            } else {
                missingVars.push(varName);
                console.warn(`[EnvInject] ⚠️ Invalid value for: ${varName}`);
            }
        } else {
            missingVars.push(varName);
            console.warn(`[EnvInject] ⚠️ Missing meta tag: ${varName}`);
        }
    });
    
    const criticalVars = [
        'NEXT_PUBLIC_FIREBASE_API_KEY',
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
        'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
    ];
    
    const missingCritical = criticalVars.filter(v => missingVars.includes(v));
    
    if (missingCritical.length > 0) {
        console.error('[EnvInject] ❌ Critical Firebase variables missing:', missingCritical);
    }
    
    window.ENV_LOADED = true;
    window.ENV_STATUS = {
        loaded: loadedCount,
        total: envVars.length,
        missing: missingVars,
        criticalMissing: missingCritical,
        timestamp: new Date().toISOString()
    };
    
    window.dispatchEvent(new CustomEvent('env-loaded', {
        detail: window.ENV_STATUS
    }));
    
    window.getEnvStatus = function() {
        return window.ENV_STATUS;
    };
    
    window.getEnv = function(key, defaultValue = null) {
        return window.ENV[key] || window.process.env[key] || defaultValue;
    };
    
    // ✅ DEBUG: طباعة الحالة للمساعدة في التشخيص
    console.log('[EnvInject] Status:', window.ENV_STATUS);
})();


