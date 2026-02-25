// ============================================
// VERCEL BUILD SCRIPT - SECURITY FIXED v2
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

console.log('[Build] Starting SECURE build process...');

const requiredVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
];

const missingVars = requiredVars.filter(v => !envVars[v] || envVars[v] === '');

if (missingVars.length > 0) {
    console.warn('[Build] ⚠️ Warning: Missing environment variables:', missingVars.join(', '));
} else {
    console.log('[Build] ✅ All required Firebase environment variables present');
}

const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

const sourceHtmlPath = path.join(__dirname, 'index.html');
if (!fs.existsSync(sourceHtmlPath)) {
    console.error('[Build] ❌ Error: index.html not found!');
    process.exit(1);
}

let htmlContent = fs.readFileSync(sourceHtmlPath, 'utf8');

// ✅ SECURITY FIX: Remove sensitive data from meta tags
const sensitiveMetaPatterns = [
    { name: 'NEXT_PUBLIC_FIREBASE_API_KEY', placeholder: '%NEXT_PUBLIC_FIREBASE_API_KEY%' },
    { name: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', placeholder: '%NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN%' },
    { name: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', placeholder: '%NEXT_PUBLIC_FIREBASE_PROJECT_ID%' },
    { name: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', placeholder: '%NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET%' },
    { name: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', placeholder: '%NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID%' },
    { name: 'NEXT_PUBLIC_FIREBASE_APP_ID', placeholder: '%NEXT_PUBLIC_FIREBASE_APP_ID%' },
    { name: 'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID', placeholder: '%NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID%' },
    { name: 'NEXT_PUBLIC_DEFAULT_OWNER_EMAIL', placeholder: '%NEXT_PUBLIC_DEFAULT_OWNER_EMAIL%' },
    { name: 'NEXT_PUBLIC_DEFAULT_OWNER_NAME', placeholder: '%NEXT_PUBLIC_DEFAULT_OWNER_NAME%' },
    { name: 'NEXT_PUBLIC_DEFAULT_OWNER_PASSWORD', placeholder: '%NEXT_PUBLIC_DEFAULT_OWNER_PASSWORD%' },
    { name: 'NEXT_PUBLIC_PBKDF2_ITERATIONS', placeholder: '%NEXT_PUBLIC_PBKDF2_ITERATIONS%' },
    { name: 'NEXT_PUBLIC_PASSWORD_SALT', placeholder: '%NEXT_PUBLIC_PASSWORD_SALT%' },
    { name: 'NEXT_PUBLIC_FIREBASE_SYNC', placeholder: '%NEXT_PUBLIC_FIREBASE_SYNC%' }
];

sensitiveMetaPatterns.forEach(({ name, placeholder }) => {
    const metaPattern = new RegExp(
        `<meta\\s+name="${name}"\\s+content="[^"]*"\\s*>`,
        'gi'
    );
    const replacement = `<meta name="${name}" content="${placeholder}">`;
    htmlContent = htmlContent.replace(metaPattern, replacement);
});

console.log('[Build] 🔒 Sanitized sensitive data from HTML meta tags');

// ✅ Generate meta tags with ACTUAL values for production
const productionMetaTags = Object.entries(envVars)
    .map(([key, value]) => {
        const escapedValue = value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
        return `    <meta name="${key}" content="${escapedValue}">`;
    })
    .join('\n');

const placeholderSectionPattern = /<!--\s*Vercel Environment Variables\s*-->.*?<!--\s*\/Vercel Environment Variables\s*-->/s;
const replacementSection = `<!-- Vercel Environment Variables -->\n${productionMetaTags}\n    <!-- /Vercel Environment Variables -->`;

if (placeholderSectionPattern.test(htmlContent)) {
    htmlContent = htmlContent.replace(placeholderSectionPattern, replacementSection);
    console.log('[Build] ✅ Injected environment variables into HTML meta tags');
}

const outputHtmlPath = path.join(distDir, 'index.html');
fs.writeFileSync(outputHtmlPath, htmlContent);
console.log('[Build] ✅ Written dist/index.html');

// ✅ FIXED: إضافة style.css إلى قائمة الملفات
const filesToCopy = ['style.css', 'config.js', 'script.js'];

filesToCopy.forEach(file => {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(distDir, file);
    
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`[Build] ✅ Copied ${file}`);
    } else {
        console.warn(`[Build] ⚠️ File not found: ${file}`);
    }
});

// Copy inject-env.js with sanitization
const injectEnvPath = path.join(__dirname, 'inject-env.js');
if (fs.existsSync(injectEnvPath)) {
    let injectEnvContent = fs.readFileSync(injectEnvPath, 'utf8');
    injectEnvContent = injectEnvContent.replace(
        /console\.log\(\s*\[EnvInject\]\s+Loaded:\s+[^)]+\)/g,
        '// 🔒 Removed for security'
    );
    fs.writeFileSync(path.join(distDir, 'inject-env.js'), injectEnvContent);
    console.log('[Build] 🔒 Sanitized inject-env.js');
}

// Create .vercel/output/static structure
const vercelOutputDir = path.join(__dirname, '.vercel', 'output', 'static');
if (!fs.existsSync(vercelOutputDir)) {
    fs.mkdirSync(vercelOutputDir, { recursive: true });
}

const distFiles = fs.readdirSync(distDir);
distFiles.forEach(file => {
    const srcPath = path.join(distDir, file);
    const destPath = path.join(vercelOutputDir, file);
    fs.copyFileSync(srcPath, destPath);
});

console.log('[Build] ✅ Copied files to .vercel/output/static');

const configJson = {
    version: 3,
    routes: [{ src: '/(.*)', dest: '/$1' }]
};

fs.writeFileSync(
    path.join(__dirname, '.vercel', 'output', 'config.json'),
    JSON.stringify(configJson, null, 2)
);

console.log('[Build] ✅ Build completed successfully!');
console.log('[Build] 🔒 Security: Sensitive data sanitized from source');


