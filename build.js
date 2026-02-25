// ============================================
// VERCEL BUILD SCRIPT
// Injects environment variables into HTML meta tags
// ============================================

const fs = require('fs');
const path = require('path');

// Environment variables to inject (from Vercel)
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

console.log('[Build] Starting build process...');
console.log('[Build] Environment check:');
console.log('  - NODE_ENV:', process.env.NODE_ENV);
console.log('  - VERCEL_ENV:', process.env.VERCEL_ENV);
console.log('  - VERCEL_URL:', process.env.VERCEL_URL);

// Check if required Firebase vars are present
const requiredVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
];

const missingVars = requiredVars.filter(v => !envVars[v] || envVars[v] === '');

if (missingVars.length > 0) {
  console.warn('[Build] ⚠️ Warning: Missing environment variables:', missingVars.join(', '));
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
// Look for the pattern in index.html and replace
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

// Copy other static files to dist
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

// Create .vercel/output/static structure (for Vercel Build Output API)
const vercelOutputDir = path.join(__dirname, '.vercel', 'output', 'static');
if (!fs.existsSync(vercelOutputDir)) {
  fs.mkdirSync(vercelOutputDir, { recursive: true });
}

// Copy all dist files to .vercel/output/static
const distFiles = fs.readdirSync(distDir);
distFiles.forEach(file => {
  const srcPath = path.join(distDir, file);
  const destPath = path.join(vercelOutputDir, file);
  fs.copyFileSync(srcPath, destPath);
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
console.log('[Build] ✅ Build completed successfully!');

// Log summary
console.log('\n[Build] Summary:');
console.log(`  - Output directory: ${distDir}`);
console.log(`  - Files processed: ${filesToCopy.length + 1}`);
console.log(`  - Environment variables injected: ${Object.keys(envVars).length}`);
