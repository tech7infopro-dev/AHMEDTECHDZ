// ============================================
// VERCEL BUILD SCRIPT - SECURE VERSION (No Meta Tags)
// ============================================

const fs = require('fs');
const path = require('path');

console.log('[Build] Starting secure build process...');

// Environment variables to inject (from Vercel)
const envVars = {
    // Firebase Configuration
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
    
    // Default Owner Account
    NEXT_PUBLIC_DEFAULT_OWNER_EMAIL: process.env.NEXT_PUBLIC_DEFAULT_OWNER_EMAIL || '',
    NEXT_PUBLIC_DEFAULT_OWNER_NAME: process.env.NEXT_PUBLIC_DEFAULT_OWNER_NAME || '',
    NEXT_PUBLIC_DEFAULT_OWNER_PASSWORD: process.env.NEXT_PUBLIC_DEFAULT_OWNER_PASSWORD || '',
    
    // Security Settings
    NEXT_PUBLIC_PBKDF2_ITERATIONS: process.env.NEXT_PUBLIC_PBKDF2_ITERATIONS || '310000',
    NEXT_PUBLIC_PASSWORD_SALT: process.env.NEXT_PUBLIC_PASSWORD_SALT || '',
    NEXT_PUBLIC_FIREBASE_SYNC: process.env.NEXT_PUBLIC_FIREBASE_SYNC || 'true'
};

// Check environment
console.log('[Build] Environment:', process.env.VERCEL_ENV || 'local');

// Check if required Firebase vars are present (without showing values)
const requiredVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
];

const missingVars = requiredVars.filter(v => !envVars[v] || envVars[v] === '');

if (missingVars.length > 0) {
    console.warn('[Build] ⚠️ Missing environment variables:', missingVars.join(', '));
    console.warn('[Build] App will use fallback values');
} else {
    console.log('[Build] ✅ All required Firebase environment variables present');
}

// Create dist directory
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Read source HTML
const sourceHtmlPath = path.join(__dirname, 'index.html');
if (!fs.existsSync(sourceHtmlPath)) {
    console.error('[Build] ❌ Error: index.html not found!');
    process.exit(1);
}

let htmlContent = fs.readFileSync(sourceHtmlPath, 'utf8');

// 🛡️ SECURITY: Remove ALL environment variable meta tags completely
// Remove old meta tags placeholder
const metaTagPattern = /<!-- Vercel Environment Variables -->[\s\S]*?<!-- \/Vercel Environment Variables -->/g;
htmlContent = htmlContent.replace(metaTagPattern, '');

// Remove individual meta tags if any
const individualMetaPattern = /<meta name="NEXT_PUBLIC_[^"]*" content="[^"]*">/g;
htmlContent = htmlContent.replace(individualMetaPattern, '');

// Generate obfuscated JavaScript with environment variables
const envScript = `
// Auto-generated environment variables - DO NOT MODIFY
(function(){
    'use strict';
    window.__ENV__ = ${JSON.stringify(envVars)};
    Object.defineProperty(window, '__ENV__', {
        enumerable: false,
        configurable: false,
        writable: false
    });
})();
`;

// Inject environment script BEFORE any other scripts
const headEndIndex = htmlContent.indexOf('</head>');
if (headEndIndex !== -1) {
    htmlContent = htmlContent.slice(0, headEndIndex) + 
                  `<script>${envScript}</script>\n` + 
                  htmlContent.slice(headEndIndex);
    console.log('[Build] ✅ Injected secure environment variables');
}

// Write processed HTML to dist
const outputHtmlPath = path.join(distDir, 'index.html');
fs.writeFileSync(outputHtmlPath, htmlContent);
console.log('[Build] ✅ Written dist/index.html');

// ============================================
// COPY ALL STATIC FILES
// ============================================

// Helper function to copy directory recursively
function copyDirectorySync(src, dest) {
    if (!fs.existsSync(src)) {
        console.log(`[Build] ℹ️ Source not found: ${src}`);
        return;
    }
    
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

// Copy individual files
const filesToCopy = [
    'style.css',
    'config.js',
    'script.js',
    'inject-env.js',
    'sw.js'
];

filesToCopy.forEach(file => {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(distDir, file);
    
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`[Build] ✅ Copied ${file}`);
    } else {
        console.warn(`[Build] ⚠️ ${file} not found, skipping`);
    }
});

// Copy static directories
const staticDirs = [
    'images',      // Images and icons
    'img',         // Alternative images folder
    'assets',      // General assets
    'fonts',       // Fonts
    'uploads',     // Uploads
    'css',         // Additional CSS
    'js',          // Additional JS
    'media',       // Audio/Video
    'icons',       // Icons
    'data'         // Data files
];

staticDirs.forEach(dirName => {
    const srcDir = path.join(__dirname, dirName);
    const distDestDir = path.join(distDir, dirName);
    copyDirectorySync(srcDir, distDestDir);
});

// ============================================
// COPY IMAGE FILES IN ROOT
// ============================================

const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.bmp', '.tiff'];
const filesInRoot = fs.readdirSync(__dirname);

filesInRoot.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (imageExtensions.includes(ext)) {
        const srcPath = path.join(__dirname, file);
        const destPath = path.join(distDir, file);
        
        if (fs.statSync(srcPath).isFile()) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`[Build] 🖼️ Copied image: ${file}`);
        }
    }
});

// ============================================
// COPY JSON/XML/TXT FILES
// ============================================

const otherExtensions = ['.json', '.xml', '.txt', '.md'];
filesInRoot.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (otherExtensions.includes(ext) && !file.startsWith('.') && !file.includes('package')) {
        const srcPath = path.join(__dirname, file);
        const destPath = path.join(distDir, file);
        
        if (fs.statSync(srcPath).isFile()) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`[Build] 📋 Copied file: ${file}`);
        }
    }
});

// ============================================
// VERCEL OUTPUT STRUCTURE
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
    
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
        copyDirectorySync(srcPath, destPath);
    } else {
        fs.copyFileSync(srcPath, destPath);
    }
});

console.log('[Build] ✅ Copied to .vercel/output/static');

// Create config.json for Vercel Build Output API
const configJson = {
    version: 3,
    routes: [{ src: '/(.*)', dest: '/$1' }]
};

fs.writeFileSync(
    path.join(__dirname, '.vercel', 'output', 'config.json'),
    JSON.stringify(configJson, null, 2)
);

console.log('[Build] ✅ Created .vercel/output/config.json');
console.log('[Build] ✅ Build completed successfully!');
console.log('[Build] Summary: Environment variables are HIDDEN from HTML source');


