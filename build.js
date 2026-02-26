// ============================================
// VERCEL BUILD SCRIPT - SECURE VERSION
// يشفر المفاتيح الحساسة أثناء البناء
// ============================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// مفتاح تشفير البناء (يتم توليده عشوائياً لكل build)
const BUILD_KEY = crypto.randomBytes(32).toString('hex');

function encryptBuildTime(text, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

const envVars = {
    // Firebase Configuration
    'NEXT_PUBLIC_FIREBASE_API_KEY': process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN': process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID': process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET': process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    'NEXT_PUBLIC_FIREBASE_APP_ID': process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID': process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
    
    // Default Owner Account
    'NEXT_PUBLIC_DEFAULT_OWNER_EMAIL': process.env.NEXT_PUBLIC_DEFAULT_OWNER_EMAIL || '',
    'NEXT_PUBLIC_DEFAULT_OWNER_NAME': process.env.NEXT_PUBLIC_DEFAULT_OWNER_NAME || '',
    'NEXT_PUBLIC_DEFAULT_OWNER_PASSWORD': process.env.NEXT_PUBLIC_DEFAULT_OWNER_PASSWORD || '',
    
    // Security Settings
    'NEXT_PUBLIC_PBKDF2_ITERATIONS': process.env.NEXT_PUBLIC_PBKDF2_ITERATIONS || '310000',
    'NEXT_PUBLIC_PASSWORD_SALT': process.env.NEXT_PUBLIC_PASSWORD_SALT || '',
    'NEXT_PUBLIC_FIREBASE_SYNC': process.env.NEXT_PUBLIC_FIREBASE_SYNC || 'true'
};

console.log('[Secure Build] Starting secure build process...');

// فصل المفاتيح الحساسة
const SENSITIVE_KEYS = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_DEFAULT_OWNER_PASSWORD',
    'NEXT_PUBLIC_PASSWORD_SALT'
];

const publicVars = {};
const sensitiveVars = {};

Object.keys(envVars).forEach(key => {
    if (SENSITIVE_KEYS.includes(key) && envVars[key]) {
        sensitiveVars[key] = encryptBuildTime(envVars[key], BUILD_KEY);
    } else {
        publicVars[key] = envVars[key];
    }
});

// إنشاء dist directory
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// قراءة HTML
let htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// إنشاء meta tags للمتغيرات العامة
const publicMetaTags = Object.entries(publicVars)
    .map(([key, value]) => {
        const escaped = value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        return `    <meta name="${key}" content="${escaped}">`;
    })
    .join('\n');

// إنشاء meta tags للمتغيرات المشفرة
const sensitiveMetaTags = Object.entries(sensitiveVars)
    .map(([key, value]) => {
        return `    <meta name="_ENC_${key.replace('NEXT_PUBLIC_', '')}" content="${value}">`;
    })
    .join('\n');

// حقن مفتاح البناء (سيتم استخدامه لفك التشفير)
const buildKeyMeta = `    <meta name="_BUILD_KEY" content="${BUILD_KEY}">`;

// استبدال في HTML
const replacement = `<!-- Vercel Environment Variables -->\n${publicMetaTags}\n${sensitiveMetaTags}\n${buildKeyMeta}\n    <!-- /Vercel Environment Variables -->`;

htmlContent = htmlContent.replace(
    /<!-- Vercel Environment Variables -->[\s\S]*?<!-- \/Vercel Environment Variables -->/,
    replacement
);

// كتابة HTML
fs.writeFileSync(path.join(distDir, 'index.html'), htmlContent);

// نسخ الملفات الأخرى
['crypto-helper.js', 'secure-inject.js', 'config.js', 'script.js', 'style.css'].forEach(file => {
    const src = path.join(__dirname, file);
    const dest = path.join(distDir, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`[Build] ✅ Copied ${file}`);
    }
});

console.log('[Secure Build] ✅ Build completed with encrypted keys');
console.log('[Secure Build] Sensitive keys encrypted:', Object.keys(sensitiveVars).length);


