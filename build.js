// ============================================
// VERCEL BUILD SCRIPT - SECURITY HARDENED v4
// ============================================

const fs = require('fs');
const path = require('path');

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

// ✅ Silent check - no logging of values
const requiredVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
];

const missingVars = requiredVars.filter(v => !envVars[v] || envVars[v] === '');

if (missingVars.length > 0) {
    console.error('[Build] ❌ Missing environment variables:', missingVars.join(', '));
    process.exit(1);
}

const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

const sourceHtmlPath = path.join(__dirname, 'index.html');
if (!fs.existsSync(sourceHtmlPath)) {
    console.error('[Build] ❌ index.html not found!');
    process.exit(1);
}

let htmlContent = fs.readFileSync(sourceHtmlPath, 'utf8');

// Replace placeholders with actual values
const placeholderPattern = /<meta\s+name="(NEXT_PUBLIC_[^"]+)"\s+content="([^"]*)"\s*>/gi;

let replacements = 0;

htmlContent = htmlContent.replace(placeholderPattern, (fullMatch, varName, currentValue) => {
    const newValue = envVars[varName];
    
    if (newValue && newValue.length > 0) {
        const escapedValue = newValue
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
        
        replacements++;
        return `<meta name="${varName}" content="${escapedValue}">`;
    }
    
    return fullMatch;
});

// Write processed HTML
const outputHtmlPath = path.join(distDir, 'index.html');
fs.writeFileSync(outputHtmlPath, htmlContent);

// Copy static files
const filesToCopy = ['style.css', 'config.js', 'script.js', 'inject-env.js'];

filesToCopy.forEach(file => {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(distDir, file);
    
    if (fs.existsSync(srcPath)) {
        let content = fs.readFileSync(srcPath, 'utf8');
        
        // Remove ALL console.log statements that might expose secrets
        content = content.replace(/console\.log\([^)]*\);?/gi, '');
        content = content.replace(/console\.warn\([^)]*\);?/gi, '');
        content = content.replace(/console\.error\([^)]*\);?/gi, '');
        content = content.replace(/console\.info\([^)]*\);?/gi, '');
        content = content.replace(/console\.debug\([^)]*\);?/gi, '');
        content = content.replace(/console\.table\([^)]*\);?/gi, '');
        
        fs.writeFileSync(destPath, content);
    }
});

// Create .vercel/output/static
const vercelOutputDir = path.join(__dirname, '.vercel', 'output', 'static');
if (!fs.existsSync(vercelOutputDir)) {
    fs.mkdirSync(vercelOutputDir, { recursive: true });
}

const distFiles = fs.readdirSync(distDir);
distFiles.forEach(file => {
    const srcPath = path.join(distDir, file);
    const destPath = path.join(vercelOutputDir, file);
    
    if (fs.statSync(srcPath).isFile()) {
        fs.copyFileSync(srcPath, destPath);
    }
});

// Config
const configJson = { version: 3, routes: [{ src: '/(.*)', dest: '/$1' }] };
fs.writeFileSync(
    path.join(__dirname, '.vercel', 'output', 'config.json'),
    JSON.stringify(configJson, null, 2)
);

console.log('[Build] ✅ Build completed successfully');


