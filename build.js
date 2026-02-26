// ============================================
// VERCEL BUILD SCRIPT
// Injects environment variables into HTML meta tags
// ============================================

const fs = require('fs');
const path = require('path');

// ============================================
// ENVIRONMENT VARIABLES - ALL FROM VERCEL
// ============================================
const envVars = {
    // Firebase Configuration
    'NEXT_PUBLIC_FIREBASE_API_KEY': process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN': process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID': process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET': process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    'NEXT_PUBLIC_FIREBASE_APP_ID': process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID': process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    
    // Default Owner Account
    'NEXT_PUBLIC_DEFAULT_OWNER_EMAIL': process.env.NEXT_PUBLIC_DEFAULT_OWNER_EMAIL,
    'NEXT_PUBLIC_DEFAULT_OWNER_NAME': process.env.NEXT_PUBLIC_DEFAULT_OWNER_NAME,
    // ✅ CRITICAL: Password must be set in Vercel
    'NEXT_PUBLIC_DEFAULT_OWNER_PASSWORD': process.env.NEXT_PUBLIC_DEFAULT_OWNER_PASSWORD,
    
    // Security Settings - CRITICAL
    'NEXT_PUBLIC_PBKDF2_ITERATIONS': process.env.NEXT_PUBLIC_PBKDF2_ITERATIONS,
    'NEXT_PUBLIC_PASSWORD_SALT': process.env.NEXT_PUBLIC_PASSWORD_SALT,
    'SESSION_SECRET': process.env.SESSION_SECRET,
    'ENCRYPTION_KEY': process.env.ENCRYPTION_KEY,
    
    // Other Settings
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

console.log('[Build] Starting build process...');
console.log('[Build] Environment check:');
console.log('  - NODE_ENV:', process.env.NODE_ENV);
console.log('  - VERCEL_ENV:', process.env.VERCEL_ENV);
console.log('  - VERCEL_URL:', process.env.VERCEL_URL);

// ============================================
// CHECK CRITICAL SECRETS
// ============================================
const criticalSecrets = [
    'NEXT_PUBLIC_PASSWORD_SALT',
    'SESSION_SECRET',
    'ENCRYPTION_KEY',
    'NEXT_PUBLIC_DEFAULT_OWNER_PASSWORD'
];

const missingSecrets = [];
const loadedSecrets = [];

for (const key of criticalSecrets) {
    const value = envVars[key];
    if (!value || value.trim() === '' || value.includes('CHANGE_THIS')) {
        missingSecrets.push(key);
        console.error(`[Build] ❌ Missing or invalid secret: ${key}`);
    } else {
        loadedSecrets.push(key);
        console.log(`[Build] ✅ Secret loaded: ${key} (${value.length} chars)`);
    }
}

if (missingSecrets.length > 0) {
    console.error('');
    console.error('╔════════════════════════════════════════════════════════════════╗');
    console.error('║  ⚠️  CRITICAL SECURITY WARNING  ⚠️                           ║');
    console.error('║                                                                ║');
    console.error('║  The following secrets are MISSING in Vercel Environment:      ║');
    for (const secret of missingSecrets) {
        console.error(`║    • ${secret.padEnd(50)} ║`);
    }
    console.error('║                                                                ║');
    console.error('║  Add these in Vercel Dashboard → Settings → Environment        ║');
    console.error('║  Variables, then redeploy.                                   ║');
    console.error('╚════════════════════════════════════════════════════════════════╝');
    console.error('');
    
    // Don't fail build, but warn strongly
    process.exitCode = 0;
}

// Check Firebase vars
const requiredFirebaseVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
];

const missingFirebase = requiredFirebaseVars.filter(v => !envVars[v] || envVars[v].trim() === '');

if (missingFirebase.length > 0) {
    console.warn('[Build] ⚠️ Warning: Missing Firebase variables:', missingFirebase.join(', '));
    console.warn('[Build] The app will use fallback values from config.js');
} else {
    console.log('[Build] ✅ All required Firebase environment variables present');
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
    console.error('[Build] ❌ Error: index.html not found!');
    process.exit(1);
}

let htmlContent = fs.readFileSync(sourceHtmlPath, 'utf8');

// Generate meta tags for environment variables
const metaTags = Object.entries(envVars)
    .filter(([key, value]) => value && value.trim() !== '' && !value.includes('CHANGE_THIS'))
    .map(([key, value]) => {
        // Escape special characters for HTML
        const escapedValue = value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
        return `    <meta name="${key}" content="${escapedValue}">`;
    })
    .join('\n');

// Replace placeholder meta tags with actual values
const placeholderPattern = /<!-- Vercel Environment Variables -->[\s\S]*?<!-- \/Vercel Environment Variables -->/;
const replacement = `<!-- Vercel Environment Variables -->\n${metaTags}\n    <!-- /Vercel Environment Variables -->`;

if (placeholderPattern.test(htmlContent)) {
    htmlContent = htmlContent.replace(placeholderPattern, replacement);
    console.log('[Build] ✅ Injected environment variables into HTML meta tags');
} else {
    // If no placeholder found, insert after the first <meta charset> tag
    const charsetMeta = htmlContent.match(/<meta charset="[^"]+">/i);
    if (charsetMeta) {
        htmlContent = htmlContent.replace(
            charsetMeta[0],
            `${charsetMeta[0]}\n    <!-- Vercel Environment Variables -->\n${metaTags}\n    <!-- /Vercel Environment Variables -->`
        );
        console.log('[Build] ✅ Inserted environment variables meta tags');
    }
}

// Write processed HTML to dist
const outputHtmlPath = path.join(distDir, 'index.html');
fs.writeFileSync(outputHtmlPath, htmlContent);
console.log('[Build] ✅ Written dist/index.html');

// ============================================
// COPY STATIC FILES
// ============================================
const filesToCopy = [
    'style.css',
    'config.js',
    'script.js',
    'inject-env.js'
];

filesToCopy.forEach(file => {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(distDir, file);
    
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`[Build] ✅ Copied ${file}`);
    } else {
        console.warn(`[Build] ⚠️ Warning: ${file} not found, skipping`);
    }
});

// ============================================
// COPY STATIC DIRECTORIES
// ============================================
function copyDirectorySync(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
        console.log(`[Build] 📁 Created directory: ${path.basename(dest)}`);
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirectorySync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
            console.log(`[Build] 📄 Copied: ${entry.name}`);
        }
    }
}

const staticDirs = [
    'images', 'img', 'assets', 'fonts', 'uploads', 
    'css', 'js', 'media', 'icons', 'data'
];

staticDirs.forEach(dirName => {
    const srcDir = path.join(__dirname, dirName);
    const distDestDir = path.join(distDir, dirName);
    
    if (fs.existsSync(srcDir)) {
        copyDirectorySync(srcDir, distDestDir);
        console.log(`[Build] ✅ Copied directory to dist: ${dirName}`);
    }
});

// Copy image files in root
const filesInRoot = fs.readdirSync(__dirname);
const imageFiles = filesInRoot.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.bmp', '.tiff'].includes(ext);
});

imageFiles.forEach(file => {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(distDir, file);
    
    if (fs.statSync(srcPath).isFile()) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`[Build] 🖼️ Copied image: ${file}`);
    }
});

// Copy other files
const otherFiles = filesInRoot.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.json', '.xml', '.txt', '.md', '.pdf'].includes(ext) && !file.startsWith('.');
});

otherFiles.forEach(file => {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(distDir, file);
    
    if (fs.statSync(srcPath).isFile()) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`[Build] 📋 Copied file: ${file}`);
    }
});

// ============================================
// CREATE VERCEL OUTPUT STRUCTURE
// ============================================
const vercelOutputDir = path.join(__dirname, '.vercel', 'output', 'static');
if (!fs.existsSync(vercelOutputDir)) {
    fs.mkdirSync(vercelOutputDir, { recursive: true });
}

const distFiles = fs.readdirSync(distDir);
distFiles.forEach(file => {
    const srcPath = path.join(distDir, file);
    const destPath = path.join(vercelOutputDir, file);
    
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
        copyDirectorySync(srcPath, destPath);
    } else {
        fs.copyFileSync(srcPath, destPath);
    }
});

console.log('[Build] ✅ Copied files to .vercel/output/static');

// Create config.json for Vercel Build Output API
const configJson = {
    version: 3,
    routes: [
        {
            src: '/(.*)',
            dest: '/$1'
        }
    ]
};

fs.writeFileSync(
    path.join(__dirname, '.vercel', 'output', 'config.json'),
    JSON.stringify(configJson, null, 2)
);

console.log('[Build] ✅ Created .vercel/output/config.json');

// ============================================
// BUILD SUMMARY
// ============================================
console.log('\n[Build] ✅ Build completed successfully!');
console.log('\n[Build] Summary:');
console.log(`  - Output directory: ${distDir}`);
console.log(`  - Secrets loaded: ${loadedSecrets.length}/${criticalSecrets.length}`);
if (missingSecrets.length > 0) {
    console.log(`  - ⚠️ Secrets missing: ${missingSecrets.join(', ')}`);
}
console.log(`  - Files processed: ${filesToCopy.length + 1}`);
console.log(`  - Directories copied: ${staticDirs.filter(d => fs.existsSync(path.join(__dirname, d))).length}`);
console.log(`  - Image files copied: ${imageFiles.length}`);
console.log(`  - Other files copied: ${otherFiles.length}`);
console.log(`  - Environment variables injected: ${Object.keys(envVars).filter(k => envVars[k]).length}`);


