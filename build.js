const fs = require('fs');
const path = require('path');

// ============================================
// ENVIRONMENT VARIABLES FROM VERCEL
// ============================================
const envVars = {
    'NEXT_PUBLIC_FIREBASE_API_KEY': process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN': process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID': process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET': process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    'NEXT_PUBLIC_FIREBASE_APP_ID': process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID': process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
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
console.log('[Build] NODE_ENV:', process.env.NODE_ENV);

// ============================================
// CHECK CRITICAL VARIABLES
// ============================================
const criticalVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
];

let missingCount = 0;
for (const key of criticalVars) {
    if (!envVars[key] || envVars[key].includes('%') || envVars[key].includes('your-')) {
        console.error(`[Build] ❌ Missing: ${key}`);
        missingCount++;
    } else {
        console.log(`[Build] ✅ ${key}: ${envVars[key].substring(0, 10)}...`);
    }
}

if (missingCount > 0) {
    console.error('[Build] WARNING: Some Firebase vars missing! Check Vercel Environment Variables.');
}

// ============================================
// CREATE DIST DIRECTORY
// ============================================
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// ============================================
// READ AND PROCESS HTML
// ============================================
const sourceHtmlPath = path.join(__dirname, 'index.html');
if (!fs.existsSync(sourceHtmlPath)) {
    console.error('[Build] ❌ index.html not found!');
    process.exit(1);
}

let htmlContent = fs.readFileSync(sourceHtmlPath, 'utf8');

// ============================================
// GENERATE META TAGS (ALL VALUES, INCLUDING EMPTY)
// ============================================
let metaTags = '';
for (const [key, value] of Object.entries(envVars)) {
    const safeValue = (value && 
                      !value.includes('%') && 
                      !value.includes('your-') &&
                      !value.includes('CHANGE_THIS')) 
                      ? value 
                      : '';
    
    const escapedValue = safeValue
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    
    metaTags += `    <meta name="${key}" content="${escapedValue}">\n`;
}

// ============================================
// REPLACE IN HTML - MULTIPLE ATTEMPTS
// ============================================

// Attempt 1: Replace placeholder comment
const placeholderPattern = /<!--\s*Vercel Environment Variables\s*-->[\s\S]*?<!--\s*\/Vercel Environment Variables\s*-->/i;
const replacement = `<!-- Vercel Environment Variables -->\n${metaTags}    <!-- /Vercel Environment Variables -->`;

if (placeholderPattern.test(htmlContent)) {
    htmlContent = htmlContent.replace(placeholderPattern, replacement);
    console.log('[Build] ✅ Replaced placeholder comment');
} 
// Attempt 2: Insert after charset meta
else {
    const charsetMeta = htmlContent.match(/<meta charset="[^"]*">/i);
    if (charsetMeta) {
        htmlContent = htmlContent.replace(
            charsetMeta[0],
            `${charsetMeta[0]}\n${metaTags}`
        );
        console.log('[Build] ✅ Inserted after charset meta');
    }
    // Attempt 3: Insert after <head>
    else {
        const headTag = htmlContent.match(/<head[^>]*>/i);
        if (headTag) {
            htmlContent = htmlContent.replace(
                headTag[0],
                `${headTag[0]}\n${metaTags}`
            );
            console.log('[Build] ✅ Inserted after head tag');
        }
    }
}

// Verify injection
const metaCount = (htmlContent.match(/<meta name="NEXT_PUBLIC_/g) || []).length;
console.log(`[Build] Injected ${metaCount} meta tags`);

// ============================================
// WRITE HTML
// ============================================
const outputHtmlPath = path.join(distDir, 'index.html');
fs.writeFileSync(outputHtmlPath, htmlContent);
console.log('[Build] ✅ Written dist/index.html');

// ============================================
// COPY FILES
// ============================================
const filesToCopy = ['style.css', 'config.js', 'script.js', 'inject-env.js'];

for (const file of filesToCopy) {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(distDir, file);
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`[Build] ✅ Copied ${file}`);
    } else {
        console.warn(`[Build] ⚠️ Missing ${file}`);
    }
}

// ============================================
// COPY DIRECTORIES
// ============================================
function copyDirectorySync(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirectorySync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

const staticDirs = ['images', 'img', 'assets', 'fonts', 'uploads', 'css', 'js', 'media', 'icons', 'data'];
for (const dir of staticDirs) {
    const srcDir = path.join(__dirname, dir);
    if (fs.existsSync(srcDir)) {
        copyDirectorySync(srcDir, path.join(distDir, dir));
        console.log(`[Build] ✅ Copied ${dir}/`);
    }
}

// ============================================
// COPY ROOT FILES
// ============================================
const rootFiles = fs.readdirSync(__dirname);
for (const file of rootFiles) {
    const ext = path.extname(file).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.json', '.xml', '.txt', '.md'].includes(ext)) {
        if (fs.statSync(path.join(__dirname, file)).isFile()) {
            fs.copyFileSync(path.join(__dirname, file), path.join(distDir, file));
        }
    }
}

// ============================================
// VERCEL OUTPUT
// ============================================
const vercelOutputDir = path.join(__dirname, '.vercel', 'output', 'static');
if (!fs.existsSync(vercelOutputDir)) {
    fs.mkdirSync(vercelOutputDir, { recursive: true });
}

const distFiles = fs.readdirSync(distDir);
for (const file of distFiles) {
    const src = path.join(distDir, file);
    const dest = path.join(vercelOutputDir, file);
    if (fs.statSync(src).isDirectory()) {
        copyDirectorySync(src, dest);
    } else {
        fs.copyFileSync(src, dest);
    }
}

fs.writeFileSync(
    path.join(__dirname, '.vercel', 'output', 'config.json'),
    JSON.stringify({ version: 3, routes: [{ src: '/(.*)', dest: '/$1' }] }, null, 2)
);

console.log('[Build] ✅ Complete!');


