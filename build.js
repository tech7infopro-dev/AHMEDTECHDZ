// ============================================
// VERCEL BUILD SCRIPT - FINAL FIX v3
// ============================================

const fs = require('fs');
const path = require('path');

// Environment variables to inject (from Vercel)
const envVars = {
    'NEXT_PUBLIC_FIREBASE_API_KEY': process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN': process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID': process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET': process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    'NEXT_PUBLIC_FIREBASE_APP_ID': process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID': process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
    'NEXT_PUBLIC_DEFAULT_OWNER_EMAIL': process.env.NEXT_PUBLIC_DEFAULT_OWNER_EMAIL || '',
    'NEXT_PUBLIC_DEFAULT_OWNER_NAME': process.env.NEXT_PUBLIC_DEFAULT_OWNER_NAME || '',
    'NEXT_PUBLIC_DEFAULT_OWNER_PASSWORD': process.env.NEXT_PUBLIC_DEFAULT_OWNER_PASSWORD || '',
    'NEXT_PUBLIC_PBKDF2_ITERATIONS': process.env.NEXT_PUBLIC_PBKDF2_ITERATIONS || '310000',
    'NEXT_PUBLIC_PASSWORD_SALT': process.env.NEXT_PUBLIC_PASSWORD_SALT || '',
    'NEXT_PUBLIC_FIREBASE_SYNC': process.env.NEXT_PUBLIC_FIREBASE_SYNC || 'true'
};

console.log('[Build] ==========================================');
console.log('[Build] Starting build process...');
console.log('[Build] Node version:', process.version);

// Check if required Firebase vars are present
const requiredVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
];

const missingVars = requiredVars.filter(v => !envVars[v] || envVars[v] === '');

if (missingVars.length > 0) {
    console.error('[Build] ❌ CRITICAL ERROR: Missing environment variables:', missingVars.join(', '));
    console.error('[Build] ❌ Please set these in Vercel Dashboard > Project Settings > Environment Variables');
    // لا نوقف البناء، لكن نحذر
} else {
    console.log('[Build] ✅ All required Firebase environment variables present');
    console.log('[Build] API Key length:', envVars.NEXT_PUBLIC_FIREBASE_API_KEY.length);
    console.log('[Build] Project ID:', envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
}

// Create dist directory
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
    console.log('[Build] ✅ Created dist directory');
}

// Read source HTML
const sourceHtmlPath = path.join(__dirname, 'index.html');
if (!fs.existsSync(sourceHtmlPath)) {
    console.error('[Build] ❌ Error: index.html not found!');
    process.exit(1);
}

let htmlContent = fs.readFileSync(sourceHtmlPath, 'utf8');

// ============================================
// 🔒 SECURITY FIX: Replace placeholders with real values
// ============================================

// Pattern to find all meta tags with placeholders
const placeholderPattern = /<meta\s+name="(NEXT_PUBLIC_[^"]+)"\s+content="([^"]*)"\s*>/gi;

let match;
let replacements = 0;

// Replace each placeholder with actual value
htmlContent = htmlContent.replace(placeholderPattern, (fullMatch, varName, currentValue) => {
    const newValue = envVars[varName];
    
    if (newValue && newValue.length > 0) {
        // Escape HTML entities
        const escapedValue = newValue
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
        
        replacements++;
        return `<meta name="${varName}" content="${escapedValue}">`;
    }
    
    // If no value, keep the placeholder but log warning
    console.warn(`[Build] ⚠️ No value for ${varName}, keeping placeholder`);
    return fullMatch;
});

console.log(`[Build] ✅ Replaced ${replacements} environment variables in HTML`);

// Write processed HTML to dist
const outputHtmlPath = path.join(distDir, 'index.html');
fs.writeFileSync(outputHtmlPath, htmlContent);
console.log('[Build] ✅ Written dist/index.html');

// ============================================
// ✅ FIXED: Copy ALL static files including style.css
// ============================================

const filesToCopy = ['style.css', 'config.js', 'script.js', 'inject-env.js'];

filesToCopy.forEach(file => {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(distDir, file);
    
    if (fs.existsSync(srcPath)) {
        // For inject-env.js, we might want to sanitize it
        if (file === 'inject-env.js') {
            let content = fs.readFileSync(srcPath, 'utf8');
            // Remove any potential debug logs that might expose values
            content = content.replace(/console\.log\(\s*\[EnvInject\]\s+Loaded:[^)]+\)/gi, '// [Build] Log removed');
            fs.writeFileSync(destPath, content);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
        console.log(`[Build] ✅ Copied ${file}`);
    } else {
        console.warn(`[Build] ⚠️ File not found: ${file}`);
    }
});

// ============================================
// Create .vercel/output/static structure
// ============================================

const vercelOutputDir = path.join(__dirname, '.vercel', 'output', 'static');
if (!fs.existsSync(vercelOutputDir)) {
    fs.mkdirSync(vercelOutputDir, { recursive: true });
}

// Copy all dist files to .vercel/output/static
const distFiles = fs.readdirSync(distDir);
distFiles.forEach(file => {
    const srcPath = path.join(distDir, file);
    const destPath = path.join(vercelOutputDir, file);
    
    if (fs.statSync(srcPath).isFile()) {
        fs.copyFileSync(srcPath, destPath);
    }
});

console.log('[Build] ✅ Copied files to .vercel/output/static');

// Create config.json for Vercel Build Output API
const configJson = {
    version: 3,
    routes: [
        { src: '/(.*)', dest: '/$1' }
    ]
};

fs.writeFileSync(
    path.join(__dirname, '.vercel', 'output', 'config.json'),
    JSON.stringify(configJson, null, 2)
);

console.log('[Build] ✅ Build completed successfully!');
console.log('[Build] ==========================================');


