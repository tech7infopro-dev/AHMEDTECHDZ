const fs = require('fs');
const path = require('path');

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

const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

const sourceHtmlPath = path.join(__dirname, 'index.html');
if (!fs.existsSync(sourceHtmlPath)) {
    process.exit(1);
}

let htmlContent = fs.readFileSync(sourceHtmlPath, 'utf8');

const metaTags = Object.entries(envVars)
    .filter(([key, value]) => value && value.trim() !== '' && !value.includes('CHANGE_THIS'))
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

const placeholderPattern = /<!-- Vercel Environment Variables -->[\s\S]*?<!-- \/Vercel Environment Variables -->/;
const replacement = `<!-- Vercel Environment Variables -->\n${metaTags}\n    <!-- /Vercel Environment Variables -->`;

if (placeholderPattern.test(htmlContent)) {
    htmlContent = htmlContent.replace(placeholderPattern, replacement);
}

const outputHtmlPath = path.join(distDir, 'index.html');
fs.writeFileSync(outputHtmlPath, htmlContent);

const filesToCopy = ['style.css', 'config.js', 'script.js', 'inject-env.js'];

filesToCopy.forEach(file => {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(distDir, file);
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
    }
});

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
staticDirs.forEach(dirName => {
    const srcDir = path.join(__dirname, dirName);
    const distDestDir = path.join(distDir, dirName);
    if (fs.existsSync(srcDir)) {
        copyDirectorySync(srcDir, distDestDir);
    }
});

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
    }
});

const otherFiles = filesInRoot.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.json', '.xml', '.txt', '.md', '.pdf'].includes(ext) && !file.startsWith('.');
});

otherFiles.forEach(file => {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(distDir, file);
    if (fs.statSync(srcPath).isFile()) {
        fs.copyFileSync(srcPath, destPath);
    }
});

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

const configJson = {
    version: 3,
    routes: [{ src: '/(.*)', dest: '/$1' }]
};

fs.writeFileSync(
    path.join(__dirname, '.vercel', 'output', 'config.json'),
    JSON.stringify(configJson, null, 2)
);


