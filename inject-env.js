// ============================================
// ENVIRONMENT VARIABLES INJECTION - OPTIMIZED
// ============================================

(function() {
    'use strict';
    
    console.log('[EnvInject] Starting injection...');
    
    // إنشاء كائن البيئة العالمي
    window.ENV = window.ENV || {};
    window.process = window.process || {};
    window.process.env = window.process.env || {};
    
    // جميع متغيرات البيئة المطلوبة (Firebase + الإعدادات الأخرى)
    const envVars = [
        // Firebase Configuration
        'NEXT_PUBLIC_FIREBASE_API_KEY',
        'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
        'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
        'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
        'NEXT_PUBLIC_FIREBASE_APP_ID',
        'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID',
        
        // Default Owner Account
        'NEXT_PUBLIC_DEFAULT_OWNER_EMAIL',
        'NEXT_PUBLIC_DEFAULT_OWNER_NAME',
        'NEXT_PUBLIC_DEFAULT_OWNER_PASSWORD',
        
        // Security Settings
        'NEXT_PUBLIC_PBKDF2_ITERATIONS',
        'NEXT_PUBLIC_PASSWORD_SALT',
        'NEXT_PUBLIC_FIREBASE_SYNC'
    ];
    
    // دالة للتحقق من صحة القيمة
    function isValidValue(content) {
        if (!content) return false;
        if (typeof content !== 'string') return false;
        
        // التحقق من أن القيمة ليست placeholder
        const invalidPatterns = [
            '%',           // Vercel placeholder
            'your-',       // نمط placeholder عام
            'YOUR_',
            'undefined',
            'null',
            '[object',
            'process.env'
        ];
        
        const hasInvalidPattern = invalidPatterns.some(pattern => 
            content.toLowerCase().includes(pattern.toLowerCase())
        );
        
        if (hasInvalidPattern) return false;
        
        // التحقق من الطول المنطقي (أكثر من 3 أحرف)
        if (content.length < 3) return false;
        
        return true;
    }
    
    // القراءة من meta tags
    let loadedCount = 0;
    const loadedVars = {};
    const missingVars = [];
    
    envVars.forEach(varName => {
        const meta = document.querySelector(`meta[name="${varName}"]`);
        if (meta) {
            const content = meta.getAttribute('content');
            
            if (isValidValue(content)) {
                window.ENV[varName] = content;
                window.process.env[varName] = content;
                loadedCount++;
                loadedVars[varName] = '✅';
                console.log(`[EnvInject] Loaded: ${varName}`);
            } else {
                missingVars.push(varName);
                loadedVars[varName] = '⚠️';
                console.warn(`[EnvInject] Invalid value for ${varName}: "${content}"`);
            }
        } else {
            missingVars.push(varName);
            loadedVars[varName] = '❌';
            console.warn(`[EnvInject] Meta tag not found: ${varName}`);
        }
    });
    
    // التحقق من المتغيرات الحرجة
    const criticalVars = [
        'NEXT_PUBLIC_FIREBASE_API_KEY',
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
        'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
    ];
    
    const missingCritical = criticalVars.filter(v => missingVars.includes(v));
    
    if (missingCritical.length > 0) {
        console.error('[EnvInject] ❌ Critical variables missing:', missingCritical.join(', '));
        console.error('[EnvInject] App may use fallback values from config.js');
    } else {
        console.log('[EnvInject] ✅ All critical Firebase variables loaded');
    }
    
    console.log(`[EnvInject] Loaded ${loadedCount}/${envVars.length} variables`);
    
    // إشارة بأن التهيئة اكتملت (حتى لو كان بعض المتغيرات مفقودة)
    window.ENV_LOADED = true;
    window.ENV_STATUS = {
        loaded: loadedCount,
        total: envVars.length,
        missing: missingVars,
        criticalMissing: missingCritical
    };
    
    // حدث مخصص لإشعار باقي الكود
    window.dispatchEvent(new CustomEvent('env-loaded', {
        detail: { 
            loaded: loadedCount, 
            total: envVars.length,
            status: window.ENV_STATUS
        }
    }));
    
    // دالة مساعدة للتحقق من حالة التحميل
    window.getEnvStatus = function() {
        return window.ENV_STATUS;
    };
    
    // دالة مساعدة للحصول على متغير بيئة
    window.getEnv = function(key, defaultValue = null) {
        return window.ENV[key] || window.process.env[key] || defaultValue;
    };
})();



