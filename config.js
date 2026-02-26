// ============================================
// CONFIGURATION FILE
// ============================================

const getEnv = (key, defaultValue = null, isSecret = false) => {
    // من window.ENV (المُحمل من inject-env.js)
    if (window.ENV && window.ENV[key]) {
        return window.ENV[key];
    }
    
    // من meta tags مباشرة
    const meta = document.querySelector(`meta[name="${key}"]`);
    if (meta && meta.content) {
        const content = meta.content.trim();
        if (content && !content.includes('%') && !content.includes('your-')) {
            return content;
        }
    }
    
    if (isSecret) return null;
    return defaultValue;
};

// ============================================
// DEFAULT OWNER
// ============================================
const DEFAULT_OWNER_EMAIL = getEnv('NEXT_PUBLIC_DEFAULT_OWNER_EMAIL', 'admin@example.com');
const DEFAULT_OWNER_NAME = getEnv('NEXT_PUBLIC_DEFAULT_OWNER_NAME', 'ADMIN');
const DEFAULT_OWNER_PASSWORD = getEnv('NEXT_PUBLIC_DEFAULT_OWNER_PASSWORD', null, true);

const DEFAULT_OWNER = {
    id: DEFAULT_OWNER_NAME.toLowerCase().replace(/\s+/g, '_'),
    name: DEFAULT_OWNER_NAME,
    email: DEFAULT_OWNER_EMAIL,
    password: null,
    role: "owner",
    created: new Date().toISOString(),
    banned: false,
    lastLogin: null,
    firebaseUid: null
};

// ============================================
// CONFIG
// ============================================
const CONFIG = {
    FIREBASE: {
        API_KEY: getEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'YOUR_FIREBASE_API_KEY_HERE'),
        AUTH_DOMAIN: getEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'your-project.firebaseapp.com'),
        PROJECT_ID: getEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'your-project-id'),
        STORAGE_BUCKET: getEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'your-project.appspot.com'),
        MESSAGING_SENDER_ID: getEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', '123456789'),
        APP_ID: getEnv('NEXT_PUBLIC_FIREBASE_APP_ID', '1:123456789:web:abcdef123456'),
        MEASUREMENT_ID: getEnv('NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID', 'G-XXXXXXXXXX'),

        COLLECTIONS: {
            USERS: 'users',
            FREE_MACS: 'free_macs',
            FREE_XTREAMS: 'free_xtreams',
            TICKETS: 'tickets',
            TELEGRAM_LINKS: 'telegram_links',
            IPTV_APPS: 'iptv_apps',
            SECURITY_LOGS: 'security_logs',
            SYSTEM_CONFIG: 'system_config'
        },

        SYNC: {
            ENABLED: true,
            AUTO_SYNC: true,
            SYNC_INTERVAL: 30000,
            OFFLINE_PERSISTENCE: true,
            CONFLICT_RESOLUTION: 'server'
        }
    },

    SECURITY: {
        PBKDF2: {
            ITERATIONS: parseInt(getEnv('NEXT_PUBLIC_PBKDF2_ITERATIONS') || '310000'),
            KEY_LENGTH: 256,
            HASH: 'SHA-256',
            SALT_LENGTH: 32,
            LEGACY_ITERATIONS: 100000,
            AUTO_UPGRADE: true,
            SALT: getEnv('NEXT_PUBLIC_PASSWORD_SALT', null, true) // ✅ لا default
        },

        SESSION: {
            SECRET: getEnv('SESSION_SECRET', null, true), // ✅ لا default
            TIMEOUT: parseInt(getEnv('SESSION_TIMEOUT') || '3600000'),
            RENEWAL_THRESHOLD: 300000,
            ABSOLUTE_TIMEOUT: 28800000,
            IDLE_TIMEOUT: 1800000,
            BIND_TO_IP: false,
            BIND_TO_USER_AGENT: true
        },

        CSRF: {
            TOKEN_LENGTH: 64,
            TOKEN_NAME: 'X-CSRF-Token',
            ROTATION_INTERVAL: 3600000
        },

        RATE_LIMIT: {
            MAX_ATTEMPTS: parseInt(getEnv('MAX_LOGIN_ATTEMPTS') || '5'),
            WINDOW_MS: parseInt(getEnv('RATE_LIMIT_WINDOW') || '900000'),
            BLOCK_DURATION_MS: parseInt(getEnv('LOCKOUT_DURATION') || '1800000')
        },

        SMART_DELAY: {
            ENABLED: true,
            BASE_DELAY_MS: 1000,
            MAX_DELAY_MS: 10000,
            EXPONENTIAL_FACTOR: 2,
            JITTER_PERCENTAGE: 0.2
        },

        COOKIES: {
            HTTP_ONLY: true,
            SECURE: true,
            SAME_SITE: 'Strict',
            MAX_AGE: 86400,
            PATH: '/'
        },

        LOGGING: {
            ENABLED: true,
            ENCRYPTION_KEY_LENGTH: 256,
            MAX_LOG_ENTRIES: 1000,
            AUTO_FLUSH_INTERVAL: 300000,
            SENSITIVE_FIELDS: ['password', 'token', 'secret', 'key', 'hash', 'salt']
        },

        SECURITY_LOGGING: {
            ENABLED: true,
            MAX_ENTRIES: 5000,
            STORAGE_KEY: 'iptv_security_logs_v2',
            LOG_TYPES: [
                'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGE',
                'PASSWORD_RESET', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED',
                'SUSPICIOUS_ACTIVITY', 'DATA_ACCESS', 'CONFIG_CHANGE',
                'FIREBASE_SYNC', 'FIREBASE_ERROR', 'OWNER_LOGIN'
            ],
            ALERT_THRESHOLD: 5,
            AUTO_NOTIFY: false
        },

        PASSWORD_POLICY: {
            MIN_LENGTH: 8,
            RECOMMENDED_LENGTH: 12,
            REQUIRE_UPPERCASE: true,
            REQUIRE_LOWERCASE: true,
            REQUIRE_NUMBERS: true,
            REQUIRE_SPECIAL: false,
            MAX_AGE_DAYS: 90,
            HISTORY_COUNT: 5
        },

        ENCRYPTION: {
            MASTER_KEY: getEnv('ENCRYPTION_KEY', null, true), // ✅ لا default
            AUTO_ROTATE: getEnv('AUTO_ROTATE_KEYS') === 'true',
            ROTATION_INTERVAL_DAYS: parseInt(getEnv('KEY_ROTATION_INTERVAL') || '30')
        }
    },

    DEFAULT_USERS: [DEFAULT_OWNER],

    DEFAULT_PASSWORDS: DEFAULT_OWNER_PASSWORD ? {
        [DEFAULT_OWNER_EMAIL]: DEFAULT_OWNER_PASSWORD
    } : {},

    PERMISSIONS: { /* ... نفس السابق ... */ },
    MAC_PERMISSIONS: { /* ... نفس السابق ... */ },
    XTREAM_PERMISSIONS: { /* ... نفس السابق ... */ },
    TELEGRAM_PERMISSIONS: { /* ... نفس السابق ... */ },
    IPTV_APPS_PERMISSIONS: { /* ... نفس السابق ... */ },
    
    STORAGE_KEYS: {
        USERS: 'iptv_users_v2',
        CURRENT_USER: 'iptv_current_user_v2',
        NEXT_USER_ID: 'iptv_next_id',
        FREE_MACS: 'iptv_free_macs',
        NEXT_MAC_ID: 'iptv_next_mac_id',
        FREE_XTREAMS: 'iptv_free_xtreams',
        NEXT_XTREAM_ID: 'iptv_next_xtream_id',
        TICKETS: 'iptv_tickets',
        NEXT_TICKET_ID: 'iptv_next_ticket_id',
        TELEGRAM_LINKS: 'iptv_telegram_links',
        IPTV_APPS: 'iptv_apps',
        NEXT_APP_ID: 'iptv_next_app_id',
        CSRF_TOKEN: 'iptv_csrf_token',
        SESSION_DATA: 'iptv_session',
        RATE_LIMIT: 'iptv_rate_limit',
        SECURITY_LOG: 'iptv_security_log',
        ENCRYPTED_LOGS: 'iptv_encrypted_logs',
        LOG_ENCRYPTION_KEY: 'iptv_log_key',
        SMART_DELAY: 'iptv_smart_delay',
        COOKIE_CONSENT: 'iptv_cookie_consent',
        SECURITY_LOGS_V2: 'iptv_security_logs_v2',
        BLOCKED_IPS: 'iptv_blocked_ips',
        PASSWORD_HISTORY: 'iptv_password_history',
        LOGIN_ATTEMPTS_DETAIL: 'iptv_login_attempts_detail',
        FIREBASE_SYNC_QUEUE: 'iptv_firebase_sync_queue',
        LAST_SYNC: 'iptv_last_sync',
        OFFLINE_CHANGES: 'iptv_offline_changes'
    },

    SYSTEM: {
        CHECK_EXPIRY_INTERVAL: 3600000,
        MIN_PASSWORD_LENGTH: 8,
        DEFAULT_ROLE: 'user',
        DATE_FORMAT: 'en-US',
        MAX_LOGIN_ATTEMPTS: parseInt(getEnv('MAX_LOGIN_ATTEMPTS') || '5'),
        LOCKOUT_DURATION: parseInt(getEnv('LOCKOUT_DURATION') || '1800000'),
        PASSWORD_EXPIRY_WARNING_DAYS: 7,
        SESSION_WARNING_BEFORE_TIMEOUT: 300000,
        AUTO_LOGOUT_ON_CLOSE: false,
        SECURE_CONTEXT_REQUIRED: true,
        DEBUG_MODE: false,
        APP_NAME: getEnv('APP_NAME') || 'IPTV Management System',
        APP_URL: getEnv('APP_URL') || 'https://your-domain.vercel.app',
        SUPPORT_EMAIL: getEnv('SUPPORT_EMAIL') || 'support@yourdomain.com',
        ENABLE_REGISTRATION: getEnv('ENABLE_REGISTRATION') !== 'false',
        ENABLE_PASSWORD_RESET: getEnv('ENABLE_PASSWORD_RESET') !== 'false',
        ENABLE_FIREBASE_SYNC: getEnv('ENABLE_FIREBASE_SYNC') !== 'false'
    },

    SECURITY_HEADERS: {
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://*.firebaseio.com https://*.googleapis.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://firestore.googleapis.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests;",
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'X-Permitted-Cross-Domain-Policies': 'none',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Resource-Policy': 'same-origin'
    }
};

// ============================================
// HIDE SECRETS FROM CONSOLE
// ============================================
const _secrets = {
    salt: CONFIG.SECURITY.PBKDF2.SALT,
    sessionSecret: CONFIG.SECURITY.SESSION.SECRET,
    encryptionKey: CONFIG.SECURITY.ENCRYPTION.MASTER_KEY
};

Object.defineProperty(CONFIG.SECURITY.PBKDF2, 'SALT', {
    get: () => _secrets.salt,
    enumerable: false,
    configurable: false
});

Object.defineProperty(CONFIG.SECURITY.SESSION, 'SECRET', {
    get: () => _secrets.sessionSecret,
    enumerable: false,
    configurable: false
});

Object.defineProperty(CONFIG.SECURITY.ENCRYPTION, 'MASTER_KEY', {
    get: () => _secrets.encryptionKey,
    enumerable: false,
    configurable: false
});

Object.freeze(CONFIG);


