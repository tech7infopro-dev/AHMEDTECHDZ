// ============================================
// ENVIRONMENT VARIABLES INJECTION - SECURE VERSION
// No sensitive data logging to console
// ============================================

(function() {
    'use strict';

    // إنشاء كائن البيئة العالمي
    window.ENV = window.ENV || {};
    window.process = window.process || {};
    window.process.env = window.process.env || {};

    // جميع متغيرات البيئة المطلوبة
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

    // دالة للتحقق من صحة القيمة
    function isValidValue(content) {
        if (!content || typeof content !== 'string') return false;

        const invalidPatterns = [
            '%', 'your-', 'YOUR_', 'undefined', 'null', '[object', 'process.env'
        ];

        const hasInvalidPattern = invalidPatterns.some(pattern => 
            content.toLowerCase().includes(pattern.toLowerCase())
        );

        if (hasInvalidPattern) return false;
        if (content.length < 3) return false;

        return true;
    }

    // القراءة من meta tags بدون تسجيل القيم
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

    // التحقق من المتغيرات الحرجة (بدون طباعة القيم)
    const criticalVars = [
        'NEXT_PUBLIC_FIREBASE_API_KEY',
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
        'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
    ];

    const missingCritical = criticalVars.filter(v => missingVars.includes(v));

    // تسجيل عام فقط - بدون قيم حساسة
    if (missingCritical.length > 0) {
        console.log('[EnvInject] ⚠️ Some Firebase config missing, using fallbacks');
    } else {
        console.log('[EnvInject] ✅ Firebase configuration loaded successfully');
    }

    // إشارة بأن التهيئة اكتملت
    window.ENV_LOADED = true;
    window.ENV_STATUS = {
        loaded: loadedCount,
        total: envVars.length,
        missing: missingVars.length,
        criticalMissing: missingCritical.length
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

