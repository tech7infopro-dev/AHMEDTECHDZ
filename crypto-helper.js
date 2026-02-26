// ============================================
// CRYPTO HELPER - Client-Side Encryption Layer
// تشفير المفاتيح في المتصفح فقط
// ============================================

class SecureKeyManager {
    constructor() {
        this.encryptedKeys = new Map();
        this.decryptedKeys = new Map();
        this.keyExpiry = null;
        this.sessionPassword = null;
    }

    // توليد مفتاح جلسة من كلمة مرور المستخدم
    async deriveKeyFromPassword(password, salt) {
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);
        const saltBuffer = this.hexToBuffer(salt);

        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            passwordBuffer,
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );

        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: saltBuffer,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    // تشفير نص باستخدام AES-GCM
    async encrypt(text, key) {
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

        return this.bufferToBase64(combined);
    }

    // فك التشفير
    async decrypt(encryptedBase64, key) {
        try {
            const combined = this.base64ToBuffer(encryptedBase64);
            const iv = combined.slice(0, 12);
            const encrypted = combined.slice(12);

            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                encrypted
            );

            return new TextDecoder().decode(decrypted);
        } catch (e) {
            console.error('Decryption failed:', e);
            return null;
        }
    }

    // تشفير المفاتيح الحساسة قبل تخزينها
    async sealKeys(keys, userPassword) {
        const salt = this.generateSalt();
        const key = await this.deriveKeyFromPassword(userPassword, salt);
        
        const sealed = {};
        for (const [name, value] of Object.entries(keys)) {
            if (this.isSensitiveKey(name)) {
                sealed[name] = await this.encrypt(value, key);
            } else {
                sealed[name] = value; // المفاتيح غير الحساسة تبقى كما هي
            }
        }

        return { sealed, salt };
    }

    // فك تشفير المفاتيح عند الحاجة
    async unsealKeys(sealedKeys, salt, userPassword) {
        const key = await this.deriveKeyFromPassword(userPassword, salt);
        
        const unsealed = {};
        for (const [name, value] of Object.entries(sealedKeys)) {
            if (this.isSensitiveKey(name) && typeof value === 'string' && value.length > 50) {
                unsealed[name] = await this.decrypt(value, key);
            } else {
                unsealed[name] = value;
            }
        }

        return unsealed;
    }

    // التحقق من المفاتيح الحساسة
    isSensitiveKey(keyName) {
        const sensitive = [
            'API_KEY', 'APP_ID', 'MESSAGING_SENDER_ID',
            'PASSWORD', 'SALT', 'SECRET', 'KEY'
        ];
        return sensitive.some(s => keyName.toUpperCase().includes(s));
    }

    // توليد Salt عشوائي
    generateSalt() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return this.bufferToHex(array);
    }

    // Helpers
    bufferToHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    hexToBuffer(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes.buffer;
    }

    bufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    base64ToBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
}

// نظام إخفاء المفاتيح في Console
class ConsoleProtector {
    constructor() {
        this.originalLog = console.log;
        this.originalWarn = console.warn;
        this.originalError = console.error;
        this.sensitivePatterns = [
            /AIza[0-9A-Za-z_-]{35}/,  // Firebase API Key
            /[0-9]+:[0-9a-f]{32}/,      // App ID
            /[0-9]{12}/,                // Sender ID
            /[a-z0-9-]+\.firebaseapp\.com/i,
            /[a-z0-9-]+\.appspot\.com/i,
            /g-[a-z0-9]{10}/i,          // Measurement ID
            /[a-f0-9]{64}/i,            // Hash keys
        ];
        this.isProtected = false;
    }

    protect() {
        if (this.isProtected) return;
        
        const filter = (args) => {
            return args.map(arg => {
                if (typeof arg === 'string') {
                    let filtered = arg;
                    this.sensitivePatterns.forEach(pattern => {
                        filtered = filtered.replace(pattern, '[REDACTED]');
                    });
                    return filtered;
                }
                if (typeof arg === 'object' && arg !== null) {
                    return this.sanitizeObject(arg);
                }
                return arg;
            });
        };

        console.log = (...args) => this.originalLog.apply(console, filter(args));
        console.warn = (...args) => this.originalWarn.apply(console, filter(args));
        console.error = (...args) => this.originalError.apply(console, filter(args));

        // حماية إضافية: منع الوصول المباشر لـ window.ENV
        this.protectEnvObject();

        this.isProtected = true;
    }

    sanitizeObject(obj, depth = 0) {
        if (depth > 3) return '[Max Depth]';
        if (obj === null || typeof obj !== 'object') return obj;
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item, depth + 1));
        }

        const sanitized = {};
        for (const [key, value] of Object.keys(obj)) {
            const lowerKey = key.toLowerCase();
            if (['api_key', 'app_id', 'messaging_sender_id', 'password', 'salt', 'secret', 'key', 'hash'].some(s => lowerKey.includes(s))) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'object') {
                sanitized[key] = this.sanitizeObject(value, depth + 1);
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }

    protectEnvObject() {
        // إعادة تعريف window.ENV كـ Proxy
        if (typeof window.ENV !== 'undefined') {
            const realEnv = { ...window.ENV };
            delete window.ENV;
            
            Object.defineProperty(window, 'ENV', {
                get: () => {
                    // إرجاء نسخة محمية فقط
                    const protectedEnv = {};
                    for (const [key, value] of Object.keys(realEnv)) {
                        if (this.isSensitive(key)) {
                            protectedEnv[key] = '[ENCRYPTED]';
                        } else {
                            protectedEnv[key] = value;
                        }
                    }
                    return protectedEnv;
                },
                set: () => {
                    throw new Error('ENV is read-only');
                },
                configurable: false
            });

            // توفير طريقة آمنة للوصول (للاستخدام الداخلي فقط)
            window._getSecureEnv = (key) => {
                if (this.isSensitive(key) && !window._authVerified) {
                    console.warn('Unauthorized access attempt to secure key');
                    return null;
                }
                return realEnv[key];
            };
        }
    }

    isSensitive(key) {
        const sensitive = ['API_KEY', 'APP_ID', 'MESSAGING_SENDER_ID', 'PASSWORD', 'SALT', 'SECRET', 'KEY', 'HASH'];
        return sensitive.some(s => key.toUpperCase().includes(s));
    }
}

// تهيئة الحماية
const secureKeyManager = new SecureKeyManager();
const consoleProtector = new ConsoleProtector();

// تفعيل الحماية فوراً
consoleProtector.protect();

console.log('[Secure] Console protection activated');

