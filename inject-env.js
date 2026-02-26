(function() {
    'use strict';
    
    window.ENV = {};
    window.process = { env: {} };
    
    // دالة فك التشفير البسيطة
    function decryptIfNeeded(value) {
        if (!value || !value.startsWith('ENC:')) return value;
        
        // استخدام مفتاح البناء لفك التشفير
        const key = 'temporary-build-key-change-in-production';
        const encrypted = value.substring(4);
        const parts = encrypted.split(':');
        
        if (parts.length !== 2) return value;
        
        try {
            let result = '';
            for (let i = 0; i < parts[1].length; i += 2) {
                const byte = parseInt(parts[1].substr(i, 2), 16);
                const keyByte = key.charCodeAt((i / 2) % key.length);
                result += String.fromCharCode(byte ^ keyByte);
            }
            return result;
        } catch (e) {
            return value;
        }
    }
    
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
        'SESSION_SECRET',
        'ENCRYPTION_KEY',
        'NEXT_PUBLIC_FIREBASE_SYNC'
    ];
    
    for (const varName of envVars) {
        const meta = document.querySelector(`meta[name="${varName}"]`);
        if (meta && meta.content) {
            const decrypted = decryptIfNeeded(meta.content.trim());
            if (decrypted && decrypted !== '') {
                window.ENV[varName] = decrypted;
                window.process.env[varName] = decrypted;
            }
        }
    }
    
    window.ENV_LOADED = true;
})();


