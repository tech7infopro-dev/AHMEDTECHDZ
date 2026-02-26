// ============================================
// CONSOLE BLOCKER - يُحمل قبل كل شيء
// يمنع ظهور المفاتيح في Console نهائياً
// ============================================

(function() {
    'use strict';

    // أنماط المفاتيح الحساسة
    const BLOCKED_PATTERNS = [
        /AIza[\w-]{35}/,                    // Firebase API Key
        /[\w-]+\.firebaseapp\.com/,         // Auth Domain
        /[\w-]+\.appspot\.com/,             // Storage Bucket
        /NEXT_PUBLIC_[\w_]+/,               // Env vars
        /apiKey["\']?\s*[:=]\s*["\']?[\w-]+/, // API Key assignments
        /projectId["\']?\s*[:=]\s*["\']?[\w-]+/,
        /password["\']?\s*[:=]\s*["\']?[^\s"\']+/i,
        /salt["\']?\s*[:=]\s*["\']?[^\s"\']+/i
    ];

    const SENSITIVE_KEYS = [
        'NEXT_PUBLIC_FIREBASE_API_KEY',
        'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
        'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
        'NEXT_PUBLIC_DEFAULT_OWNER_PASSWORD',
        'NEXT_PUBLIC_PASSWORD_SALT'
    ];

    // حفظ الدوال الأصلية
    const _log = console.log;
    const _warn = console.warn;
    const _error = console.error;
    const _dir = console.dir;
    const _table = console.table;

    // دالة التحقق من المحتوى الحساس
    function isSensitive(args) {
        if (!args || args.length === 0) return false;
        const text = Array.from(args).map(a => {
            if (typeof a === 'object') return JSON.stringify(a);
            return String(a);
        }).join(' ');

        // التحقق من الأنماط
        for (let pattern of BLOCKED_PATTERNS) {
            if (pattern.test(text)) return true;
        }

        // التحقق من الكلمات المفتاحية
        for (let key of SENSITIVE_KEYS) {
            if (text.includes(key)) return true;
        }

        return false;
    }

    // استبدال console methods
    console.log = function() {
        if (isSensitive(arguments)) return;
        _log.apply(console, arguments);
    };

    console.warn = function() {
        if (isSensitive(arguments)) return;
        _warn.apply(console, arguments);
    };

    console.error = function() {
        if (isSensitive(arguments)) return;
        _error.apply(console, arguments);
    };

    console.dir = function() {
        if (isSensitive(arguments)) return;
        _dir.apply(console, arguments);
    };

    console.table = function() {
        if (isSensitive(arguments)) return;
        _table.apply(console, arguments);
    };

    // منع console.debug و console.info أيضاً
    console.debug = console.log;
    console.info = console.log;

    console.log('[🔒] Console security activated - Keys are hidden');
})();
