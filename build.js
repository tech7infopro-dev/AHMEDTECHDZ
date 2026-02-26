// ============================================
// VERCEL BUILD SCRIPT - SECURE VERSION
// لا يحقن أي secrets في HTML - يستخدم API routes بدلاً من ذلك
// ============================================

const fs = require('fs');
const path = require('path');

console.log('[Build] Starting secure build process...');

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

// ❌ إزالة جميع meta tags السرية - لا نحقن أي شيء في HTML
// ✅ نحتفظ فقط بالـ meta tags العامة (viewport, theme-color, etc.)

// إزالة قسم Vercel Environment Variables بالكامل
const placeholderPattern = /<!-- Vercel Environment Variables -->[\s\S]*?<!-- \/Vercel Environment Variables -->/g;
if (placeholderPattern.test(htmlContent)) {
  htmlContent = htmlContent.replace(placeholderPattern, '<!-- Environment variables loaded securely via API -->');
  console.log('[Build] ✅ Removed environment variables from HTML (secure)');
}

// Write processed HTML to dist
const outputHtmlPath = path.join(distDir, 'index.html');
fs.writeFileSync(outputHtmlPath, htmlContent);
console.log('[Build] ✅ Written dist/index.html (secure - no secrets)');

// Copy static files to dist
const filesToCopy = [
  'style.css',
  'config.js',
  'script.js',
  'inject-env.js'  // سيتم تعديله ليصبح فارغاً أو يحذف
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
// 📁 COPY STATIC DIRECTORIES AND FILES
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

// نسخ المجلدات الثابتة
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

// نسخ ملفات الصور في الجذر
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

// ============================================
// 🛡️ إنشاء API Route للإعدادات الأمنية
// ============================================

const apiDir = path.join(distDir, 'api');
if (!fs.existsSync(apiDir)) {
  fs.mkdirSync(apiDir, { recursive: true });
}

// إنشاء API endpoint للإعدادات
const apiConfigContent = `// API Route - Server-side only (secrets hidden from client)
export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  // Return Firebase config (server-side only - not visible in source)
  res.status(200).json({
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || ''
  });
}`;

fs.writeFileSync(path.join(apiDir, 'config.js'), apiConfigContent);
console.log('[Build] ✅ Created secure API endpoint: /api/config');

// ============================================
// 📦 Vercel Build Output API
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

console.log('[Build] ✅ Copied files to .vercel/output/static');

// Create config.json for Vercel
const configJson = {
  version: 3,
  routes: [
    {
      src: '/api/(.*)',
      dest: '/api/$1'
    },
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

// Log summary
console.log('\n[Build] ✅ Secure build completed successfully!');
console.log('[Build] 🛡️ No secrets exposed in HTML source');
console.log(`[Build] 📁 Output: ${distDir}`);


