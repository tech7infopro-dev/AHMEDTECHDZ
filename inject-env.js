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
        'SESSION_SECRET',
        'ENCRYPTION_KEY',
        'NEXT_PUBLIC_FIREBASE_SYNC'
    ];
    
    let loadedCount = 0;
    
    for (const varName of envVars) {
        const meta = document.querySelector(`meta[name="${varName}"]`);
        if (meta && meta.content && meta.content.trim() !== '') {
            const content = meta.content.trim();
            // Reject placeholders
            if (!content.includes('%') && !content.includes('your-') && !content.includes('CHANGE_THIS')) {
                window.ENV[varName] = content;
                window.process.env[varName] = content;
                loadedCount++;
            }
        }
    }
    
    window.ENV_LOADED = true;
    window.ENV_STATUS = {
        loaded: loadedCount,
        total: envVars.length
    };
    
    // Silent - no console output in production
    if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
        console.log(`[EnvInject] Loaded ${loadedCount}/${envVars.length} variables`);
    }
})();


