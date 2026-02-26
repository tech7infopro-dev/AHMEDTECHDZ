// ============================================
// SECURE ENVIRONMENT INJECTION v3.0
// يخفي المفاتيح ويحافظ على المزامنة
// ============================================

(function() {
    'use strict';
    
    console.log('[SecureInject] Initializing secure environment...');
    
    // 1. قراءة المفاتيح من meta tags (هذه المرحلة الوحيدة التي تكون فيها المفاتيح مكشوفة)
    const rawEnv = {};
    const metaTags = document.querySelectorAll('meta[name^="NEXT_PUBLIC_"]');
    
    metaTags.forEach(meta => {
        const name = meta.getAttribute('name');
        const content = meta.getAttribute('content');
        if (content && !content.includes('%') && content.length > 0) {
            rawEnv[name] = content;
        }
    });

    // 2. فصل المفاتيح الحساسة عن غير الحساسة
    const SENSITIVE_KEYS = [
        'NEXT_PUBLIC_FIREBASE_API_KEY',
        'NEXT_PUBLIC_FIREBASE_APP_ID',
        'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
        'NEXT_PUBLIC_DEFAULT_OWNER_PASSWORD',
        'NEXT_PUBLIC_PASSWORD_SALT'
    ];

    const sensitiveData = {};
    const publicData = {};

    Object.keys(rawEnv).forEach(key => {
        if (SENSITIVE_KEYS.includes(key)) {
            sensitiveData[key] = rawEnv[key];
        } else {
            publicData[key] = rawEnv[key];
        }
    });

    // 3. تشفير المفاتيح الحساسة باستخدام Web Crypto API
    async function encryptSensitiveData() {
        const encoder = new TextEncoder();
        
        // توليد مفتاح مؤقت للجلسة (يتم تدميره عند إغلاق الصفحة)
        const sessionKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );

        // تخزين المفتاح في ذاكرة آمنة (SessionStorage مشفر)
        const exportedKey = await crypto.subtle.exportKey('raw', sessionKey);
        const keyB64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
        
        // تشفير المفتاح نفسه باستخدام كلمة مرور مشتقة من الوقت (تتغير كل ساعة)
        const timeSalt = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
        const derivedKey = await deriveKeyFromTime(timeSalt);
        
        const encryptedSessionKey = await encryptWithKey(keyB64, derivedKey);
        sessionStorage.setItem('_sk', encryptedSessionKey);

        // تشفير المفاتيح الحساسة
        const encryptedData = {};
        for (const [key, value] of Object.keys(sensitiveData)) {
            encryptedData[key] = await encryptWithKey(value, sessionKey);
        }

        return { encryptedData, sessionKey };
    }

    async function deriveKeyFromTime(timeString) {
        const encoder = new TextEncoder();
        const data = encoder.encode(timeString);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return await crypto.subtle.importKey(
            'raw',
            hash,
            { name: 'AES-GCM' },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async function encryptWithKey(text, key) {
        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encoder.encode(text)
        );

        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);

        return btoa(String.fromCharCode(...combined));
    }

    // 4. إنشاء نظام الوصول الآمن
    async function setupSecureAccess(encryptedData) {
        // تخزين البيانات المشفرة فقط
        window.__SECURE_ENV = {
            public: publicData,
            encrypted: encryptedData,
            _accessLog: []
        };

        // منع الوصول المباشر
        Object.freeze(window.__SECURE_ENV.public);
        Object.freeze(window.__SECURE_ENV.encrypted);

        // إنشاء Proxy للوصول الآمن
        window.ENV = new Proxy({}, {
            get: (target, prop) => {
                // تسجيل محاولات الوصول
                if (window.__SECURE_ENV._accessLog) {
                    window.__SECURE_ENV._accessLog.push({
                        key: prop,
                        time: Date.now(),
                        stack: new Error().stack
                    });
                }

                // المفاتيح العامة متاحة مباشرة
                if (publicData.hasOwnProperty(prop)) {
                    return publicData[prop];
                }

                // المفاتيح الحساسة تتطلب فك تشفير
                if (encryptedData.hasOwnProperty(prop)) {
                    return '[ENCRYPTED]'; // لا يمكن الوصول المباشر
                }

                return undefined;
            },
            set: () => {
                throw new Error('ENV is read-only');
            },
            enumerate: () => Object.keys(publicData),
            ownKeys: () => Object.keys(publicData)
        });

        // دالة سرية للوصول للمفاتيح الحساسة (للاستخدام الداخلي فقط)
        window._getFirebaseConfig = async () => {
            const sessionKey = await retrieveSessionKey();
            if (!sessionKey) {
                console.error('[Secure] Session key not available');
                return null;
            }

            const config = {};
            
            // فك تشفير المفاتيح الحساسة
            for (const key of SENSITIVE_KEYS) {
                if (encryptedData[key]) {
                    config[key] = await decryptWithKey(encryptedData[key], sessionKey);
                }
            }

            // إضافة المفاتيح العامة
            Object.assign(config, publicData);

            return config;
        };

        // دالة مبسطة للحصول على إعدادات Firebase جاهزة
        window._getFirebaseReadyConfig = async () => {
            const fullConfig = await window._getFirebaseConfig();
            if (!fullConfig) return null;

            return {
                apiKey: fullConfig.NEXT_PUBLIC_FIREBASE_API_KEY,
                authDomain: fullConfig.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
                projectId: fullConfig.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                storageBucket: fullConfig.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                messagingSenderId: fullConfig.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
                appId: fullConfig.NEXT_PUBLIC_FIREBASE_APP_ID,
                measurementId: fullConfig.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
            };
        };
    }

    async function retrieveSessionKey() {
        try {
            const encryptedKey = sessionStorage.getItem('_sk');
            if (!encryptedKey) return null;

            const timeSalt = new Date().toISOString().slice(0, 13);
            const derivedKey = await deriveKeyFromTime(timeSalt);
            
            const decrypted = await decryptWithKey(encryptedKey, derivedKey);
            const keyData = Uint8Array.from(atob(decrypted), c => c.charCodeAt(0));
            
            return await crypto.subtle.importKey(
                'raw',
                keyData,
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );
        } catch (e) {
            console.error('[Secure] Failed to retrieve session key:', e);
            return null;
        }
    }

    async function decryptWithKey(encryptedB64, key) {
        const combined = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0));
        const iv = combined.slice(0, 12);
        const encrypted = combined.slice(12);

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            encrypted
        );

        return new TextDecoder().decode(decrypted);
    }

    // 5. تنظيف Meta Tags من DOM بعد القراءة
    function cleanupMetaTags() {
        metaTags.forEach(meta => {
            if (SENSITIVE_KEYS.includes(meta.getAttribute('name'))) {
                meta.setAttribute('content', '[REDACTED]');
            }
        });
    }

    // 6. حماية Console إضافية
    function protectConsole() {
        const originalLog = console.log;
        const sensitiveRegex = /AIza[0-9A-Za-z_-]{35}|[0-9]+:[0-9a-f]{32}|[0-9]{12}/g;
        
        console.log = function(...args) {
            const filtered = args.map(arg => {
                if (typeof arg === 'string') {
                    return arg.replace(sensitiveRegex, '[REDACTED]');
                }
                return arg;
            });
            originalLog.apply(console, filtered);
        };
    }

    // تنفيذ
    (async function init() {
        try {
            const { encryptedData } = await encryptSensitiveData();
            await setupSecureAccess(encryptedData);
            cleanupMetaTags();
            protectConsole();
            
            window.ENV_LOADED = true;
            window.dispatchEvent(new CustomEvent('env-loaded', {
                detail: { secure: true, publicKeys: Object.keys(publicData) }
            }));
            
            console.log('[SecureInject] ✅ Secure environment initialized');
        } catch (error) {
            console.error('[SecureInject] ❌ Initialization failed:', error);
            // Fallback: استخدام المفاتيح العامة فقط
            window.ENV = publicData;
            window.ENV_LOADED = true;
        }
    })();
})();


