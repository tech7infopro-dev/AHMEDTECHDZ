// ============================================
// VERCEL BUILD SCRIPT - SECURE VERSION
// Injects environment variables into HTML meta tags
// No sensitive data logging
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

console.log('[Build] Starting build process...');
console.log('[Build] Environment check (non-sensitive):');
console.log('  - NODE_ENV:', process.env.NODE_ENV);
console.log('  - VERCEL_ENV:', process.env.VERCEL_ENV);

// Check if required Firebase vars are present (without logging values)
const requiredVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
];

const missingVars = requiredVars.filter(v => !envVars[v] || envVars[v] === '');

if (missingVars.length > 0) {
  console.warn('[Build] ⚠️ Warning: Missing environment variables count:', missingVars.length);
  console.warn('[Build] The app will use fallback values from config.js');
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

// Generate meta tags for environment variables
const metaTags = Object.entries(envVars)
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

// Replace placeholder meta tags
const placeholderPattern = /<!-- Vercel Environment Variables -->[\s\S]*?<!-- \/Vercel Environment Variables -->/;
const replacement = `<!-- Vercel Environment Variables -->\n${metaTags}\n    <!-- /Vercel Environment Variables -->`;

if (placeholderPattern.test(htmlContent)) {
  htmlContent = htmlContent.replace(placeholderPattern, replacement);
  console.log('[Build] ✅ Injected environment variables into HTML meta tags');
} else {
  const charsetMeta = htmlContent.match(/<meta charset="[^"]+">/i);
  if (charsetMeta) {
    htmlContent = htmlContent.replace(
      charsetMeta[0],
      `${charsetMeta[0]}\n    <!-- Vercel Environment Variables -->\n${metaTags}\n    <!-- /Vercel Environment Variables -->`
    );
    console.log('[Build] ✅ Inserted environment variables meta tags');
  }
}

// Write processed HTML
const outputHtmlPath = path.join(distDir, 'index.html');
fs.writeFileSync(outputHtmlPath, htmlContent);
console.log('[Build] ✅ Written dist/index.html');

// Copy static files
const filesToCopy = ['style.css', 'config.js', 'script.js', 'inject-env-secure.js'];

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

// Copy directories function
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

// Copy static directories
const staticDirs = ['images', 'img', 'assets', 'fonts', 'uploads', 'css', 'js', 'media', 'icons', 'data'];

staticDirs.forEach(dirName => {
  const srcDir = path.join(__dirname, dirName);
  const distDestDir = path.join(distDir, dirName);

  if (fs.existsSync(srcDir)) {
    copyDirectorySync(srcDir, distDestDir);
    console.log(`[Build] ✅ Copied directory: ${dirName}`);
  }
});

// Copy root image files
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

// Create .vercel/output/static
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

// Create config.json
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
console.log('\n[Build] Summary:');
console.log(`  - Output directory: ${distDir}`);
console.log(`  - Files processed: ${filesToCopy.length + 1}`);
console.log(`  - Directories copied: ${staticDirs.filter(d => fs.existsSync(path.join(__dirname, d))).length}`);
console.log(`  - Image files copied: ${imageFiles.length}`);
console.log(`  - Environment variables injected: ${Object.keys(envVars).length}`);

