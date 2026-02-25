// ============================================
// ENVIRONMENT VARIABLES INJECTION - SECURE VERSION
// Removes debug logs that could expose sensitive data
// ============================================

(function() {
    'use strict';
    
    // Create global ENV object
    window.ENV = window.ENV || {};
    window.process = window.process || {};
    window.process.env = window.process.env || {};
    
    // All required environment variables
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
    
    // Validate value function
    function isValidValue(content) {
        if (!content) return false;
        if (typeof content !== 'string') return false;
        
        const invalidPatterns = ['%', 'your-', 'YOUR_', 'undefined', 'null', '[object', 'process.env'];
        
        const hasInvalidPattern = invalidPatterns.some(pattern => 
            content.toLowerCase().includes(pattern.toLowerCase())
        );
        
        if (hasInvalidPattern) return false;
        if (content.length < 3) return false;
        
        return true;
    }
    
    // Read from meta tags
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
    
    // Check critical variables (only log in development)
    const criticalVars = [
        'NEXT_PUBLIC_FIREBASE_API_KEY',
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
        'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
    ];
    
    const missingCritical = criticalVars.filter(v => missingVars.includes(v));
    
    if (missingCritical.length > 0) {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.error('[EnvInject] ❌ Critical variables missing:', missingCritical.join(', '));
        }
    }
    
    // Signal that initialization is complete
    window.ENV_LOADED = true;
    window.ENV_STATUS = {
        loaded: loadedCount,
        total: envVars.length,
        missing: missingVars,
        criticalMissing: missingCritical
    };
    
    // Custom event to notify other code
    window.dispatchEvent(new CustomEvent('env-loaded', {
        detail: { 
            loaded: loadedCount, 
            total: envVars.length,
            status: window.ENV_STATUS
        }
    }));
    
    // Helper functions
    window.getEnvStatus = function() {
        return window.ENV_STATUS;
    };
    
    window.getEnv = function(key, defaultValue = null) {
        return window.ENV[key] || window.process.env[key] || defaultValue;
    };
})();


