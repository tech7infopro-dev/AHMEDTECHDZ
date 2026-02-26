const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================
// ENCRYPTION KEY FOR BUILD (مفتاح تشفير مؤقت للبناء فقط)
// ============================================
const BUILD_ENCRYPTION_KEY = process.env.BUILD_ENCRYPTION_KEY || 'temporary-build-key-change-in-production';

function encrypt(text) {
    if (!text || text.trim() === '') return '';
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', 
            crypto.scryptSync(BUILD_ENCRYPTION_KEY, 'salt', 32), iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    } catch (e) {
        return text; // Fallback
    }
}

// ============================================
// ENVIRONMENT VARIABLES
// ============================================
const envVars = {
    'NEXT_PUBLIC_FIREBASE_API_KEY': process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN': process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID': process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET': process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID': process.env.NEXT_PUBLIC_FIREBASE_APP_ID',
    'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID': process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID',
    'NEXT_PUBLIC_DEFAULT_OWNER_EMAIL': process.env.NEXT_PUBLIC_DEFAULT_OWNER_EMAIL,
    'NEXT_PUBLIC_DEFAULT_OWNER_NAME': process.env.NEXT_PUBLIC_DEFAULT_OWNER_NAME,
    'NEXT_PUBLIC_DEFAULT_OWNER_PASSWORD': process.env.NEXT_PUBLIC_DEFAULT_OWNER_PASSWORD,
    'NEXT_PUBLIC_PBKDF2_ITERATIONS': process.env.NEXT_PUBLIC_PBKDF2_ITERATIONS,
    'NEXT_PUBLIC_PASSWORD_SALT': process.env.NEXT_PUBLIC_PASSWORD_SALT,
    'SESSION_SECRET': process.env.SESSION_SECRET,
    'ENCRYPTION_KEY': process.env.ENCRYPTION_KEY,
    'NEXT_PUBLIC_FIREBASE_SYNC': process.env.NEXT_PUBLIC_FIREBASE_SYNC,
    'SESSION_TIMEOUT': process.env.SESSION_TIMEOUT,
    'MAX_LOGIN_ATTEMPTS': process.env.MAX_LOGIN_ATTEMPTS,
    'RATE_LIMIT_WINDOW': process.env.RATE_LIMIT_WINDOW,
    'LOCKOUT_DURATION': process.env.LOCKOUT_DURATION,
    'DEBUG_MODE': process.env.DEBUG_MODE,
    'APP_NAME': process.env.APP_NAME,
    'APP_URL': process.env.APP_URL,
    'SUPPORT_EMAIL': process.env.SUPPORT_EMAIL,
    'ENABLE_REGISTRATION': process.env.ENABLE_REGISTRATION,
    'ENABLE_PASSWORD_RESET': process.env.ENABLE_PASSWORD_RESET,
    'ENABLE_FIREBASE_SYNC': process.env.ENABLE_FIREBASE_SYNC,
    'AUTO_ROTATE_KEYS': process.env.AUTO_ROTATE_KEYS,
    'KEY_ROTATION_INTERVAL': process.env.KEY_ROTATION_INTERVAL
};

console.log('[Build] Starting...');

// ============================================
// CREATE DIST
// ============================================
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// ============================================
// READ HTML
// ============================================
const sourceHtmlPath = path.join(__dirname, 'index.html');
if (!fs.existsSync(sourceHtmlPath)) {
    console.error('[Build] ❌ index.html not found!');
    process.exit(1);
}

let htmlContent = fs.readFileSync(sourceHtmlPath, 'utf8');

// ============================================
// GENERATE ENCRYPTED META TAGS
// ============================================
let metaTags = '';
for (const [key, value] of Object.entries(envVars)) {
    const safeValue = (value && 
                      !value.includes('%') && 
                      !value.includes('your-') &&
                      !value.includes('CHANGE_THIS')) 
                      ? value 
                      : '';
    
    // تشفير القيم الحساسة فقط
    const needsEncryption = 
        key.includes('SALT') || 
        key.includes('SECRET') || 
        key.includes('KEY') || 
        key.includes('PASSWORD');
    
    const finalValue = needsEncryption && safeValue 
        ? 'ENC:' + encrypt(safeValue) 
        : safeValue;
    
    const escapedValue = finalValue
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    
    metaTags += `    <meta name="${key}" content="${escapedValue}">\n`;
}

// ============================================
// INJECT INTO HTML
// ============================================
const placeholderPattern = /<!--\s*Vercel Environment Variables\s*-->[\s\S]*?<!--\s*\/Vercel Environment Variables\s*-->/i;
const replacement = `<!-- Vercel Environment Variables -->\n${metaTags}    <!-- /Vercel Environment Variables -->`;

if (placeholderPattern.test(htmlContent)) {
    htmlContent = htmlContent.replace(placeholderPattern, replacement);
} else {
    const headTag = htmlContent.match(/<head[^>]*>/i);
    if (headTag) {
        htmlContent = htmlContent.replace(headTag[0], `${headTag[0]}\n${metaTags}`);
    }
}

// ============================================
// ADD DECRYPTION SCRIPT
// ============================================
const decryptionScript = `
<script>
(function() {
    const BUILD_KEY = '${BUILD_ENCRYPTION_KEY}';
    
    function decrypt(encryptedText) {
        if (!encryptedText.startsWith('ENC:')) return encryptedText;
        try {
            const text = encryptedText.substring(4);
            const parts = text.split(':');
            const iv = hexToBuffer(parts[0]);
            const encrypted = parts[1];
            
            // Simple XOR decryption for demo (use proper AES in production)
            let result = '';
            for (let i = 0; i < encrypted.length; i += 2) {
                const byte = parseInt(encrypted.substr(i, 2), 16);
                const keyByte = BUILD_KEY.charCodeAt(i / 2 % BUILD_KEY.length);
                result += String.fromCharCode(byte ^ keyByte);
            }
            return result;
        } catch (e) {
            return encryptedText;
        }
    }
    
    function hexToBuffer(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }
    
    window.decryptEnv = decrypt;
})();
</script>
`;

htmlContent = htmlContent.replace('</head>', `${decryptionScript}\n</head>`);

// ============================================
// WRITE AND COPY FILES
// ============================================
fs.writeFileSync(path.join(distDir, 'index.html'), htmlContent);

['style.css', 'config.js', 'script.js', 'inject-env.js'].forEach(file => {
    const src = path.join(__dirname, file);
    const dest = path.join(distDir, file);
    if (fs.existsSync(src)) fs.copyFileSync(src, dest);
});

// Copy directories
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src, { withFileTypes: true }).forEach(entry => {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
    });
}

['images', 'assets', 'fonts', 'uploads', 'css', 'js', 'media', 'icons', 'data'].forEach(dir => {
    const src = path.join(__dirname, dir);
    if (fs.existsSync(src)) copyDir(src, path.join(distDir, dir));
});

// Vercel output
const vercelDir = path.join(__dirname, '.vercel', 'output', 'static');
if (!fs.existsSync(vercelDir)) fs.mkdirSync(vercelDir, { recursive: true });

fs.readdirSync(distDir).forEach(file => {
    const s = path.join(distDir, file);
    const d = path.join(vercelDir, file);
    fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
});

fs.writeFileSync(
    path.join(__dirname, '.vercel', 'output', 'config.json'),
    JSON.stringify({ version: 3, routes: [{ src: '/(.*)', dest: '/$1' }] })
);

console.log('[Build] ✅ Complete!');


