// ============================================
// ENVIRONMENT VARIABLES INJECTION - FINAL FIX v3
// ============================================

(function() {
    'use strict';
    
    // Create global ENV object
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
        if (!content || typeof content !== 'string') {
            return false;
        }
        
        // ✅ رفض الـ placeholders الواضحة
        if (content.startsWith('%') && content.endsWith('%')) {
            return false;
        }
        
        if (content.includes('%NEXT_PUBLIC_')) {
            return false;
        }
        
        // ✅ رفض القيم الافتراضية/التوجيهية
        const invalidValues = [
            'your-firebase-api-key',
            'your-project-id',
            'your-api-key',
            'undefined',
            'null',
            '',
            'process.env.NEXT_PUBLIC'
        ];
        
        const lowerContent = content.toLowerCase();
        for (const invalid of invalidValues) {
            if (lowerContent.includes(invalid)) {
                return false;
            }
        }
        
        // ✅ القيمة يجب أن تكون طويلة بما يكفي (Firebase API keys are typically 39 chars)
        if (content.length < 10) {
            return false;
        }
        
        return true;
    }
    
    let loadedCount = 0;
    const missingVars = [];
    const loadedValues = {};
    
    // ✅ محاولة 1: قراءة من meta tags
    envVars.forEach(varName => {
        const meta = document.querySelector(`meta[name="${varName}"]`);
        if (meta) {
            const content = meta.getAttribute('content');
            
            if (isValidValue(content)) {
                window.ENV[varName] = content;
                window.process.env[varName] = content;
                loadedCount++;
                loadedValues[varName] = content.substring(0, 10) + '...';
            } else {
                missingVars.push(varName);
                console.warn(`[EnvInject] ⚠️ Invalid/placeholder value for ${varName}: "${content?.substring(0, 30)}"`);
            }
        } else {
            missingVars.push(varName);
        }
    });
    
    // ✅ محاولة 2: التحقق من window.__ENV (بعض الإعدادات تستخدم هذا)
    if (typeof window.__ENV !== 'undefined') {
        envVars.forEach(varName => {
            if (!window.ENV[varName] && window.__ENV[varName]) {
                window.ENV[varName] = window.__ENV[varName];
                window.process.env[varName] = window.__ENV[varName];
                loadedCount++;
                loadedValues[varName] = window.__ENV[varName].substring(0, 10) + '...';
                // إزالة من missing إذا كانت موجودة
                const idx = missingVars.indexOf(varName);
                if (idx > -1) missingVars.splice(idx, 1);
            }
        });
    }
    
    const criticalVars = [
        'NEXT_PUBLIC_FIREBASE_API_KEY',
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
        'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
    ];
    
    const missingCritical = criticalVars.filter(v => !window.ENV[v]);
    
    // ✅ DEBUG INFO
    window.ENV_LOADED = missingCritical.length === 0;
    window.ENV_STATUS = {
        loaded: loadedCount,
        total: envVars.length,
        missing: missingVars,
        criticalMissing: missingCritical,
        loadedValues: loadedValues,
        timestamp: new Date().toISOString()
    };
    
    console.log('[EnvInject] ==========================================');
    console.log('[EnvInject] Environment Variables Status:');
    console.log('[EnvInject] Loaded:', loadedCount, 'of', envVars.length);
    console.log('[EnvInject] Missing:', missingVars);
    console.log('[EnvInject] Critical Missing:', missingCritical);
    console.log('[EnvInject] ==========================================');
    
    // ✅ Dispatch event
    window.dispatchEvent(new CustomEvent('env-loaded', {
        detail: window.ENV_STATUS
    }));
    
    // ✅ Helper functions
    window.getEnvStatus = function() {
        return window.ENV_STATUS;
    };
    
    window.getEnv = function(key, defaultValue = null) {
        return window.ENV[key] || window.process.env[key] || defaultValue;
    };
    
    // ✅ إذا كانت القيم الحرجة مفقودة، نحاول استخدام القيم من config.js كـ fallback
    if (missingCritical.length > 0) {
        console.warn('[EnvInject] ⚠️ Critical variables missing! Firebase sync may not work.');
        console.warn('[EnvInject] ⚠️ Make sure environment variables are set in Vercel dashboard.');
    }
})();


