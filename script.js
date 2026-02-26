/* ============================================
   AHMEDTECH DZ IPTV - User Management System
   Main JavaScript File - EMAIL AUTHENTICATION VERSION
   ============================================ */
// ============================================
// SECURITY LAYER - Added at top of script.js
// ============================================

// حظر Console قبل أي شيء
(function() {
    'use strict';
    
    const SENSITIVE_PATTERNS = [
        /AIza[\w-]{35}/,                    // Firebase API Key
        /[\w-]+\.firebaseapp\.com/,         // Auth Domain  
        /[\w-]+\.appspot\.com/,             // Storage Bucket
        /[\w-]+\.firebasestorage\.app/,     // New Storage format
        /NEXT_PUBLIC_[\w_]+/,               // Env vars names
        /apiKey["']?\s*[:=]\s*["']?[\w-]+/, // API Key in objects
        /projectId["']?\s*[:=]\s*["']?[\w-]+/,
        /messagingSenderId["']?\s*[:=]\s*["']?\d+/,
        /appId["']?\s*[:=]\s*["']?1:[\w-]+/,
        /measurementId["']?\s*[:=]\s*["']?G-[\w-]+/,
        /password["']?\s*[:=]/i,
        /salt["']?\s*[:=]/i,
        /CHANGE_THIS/i
    ];
    
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    
    function containsSensitiveData(args) {
        if (!args || args.length === 0) return false;
        const text = Array.from(args).map(arg => {
            if (arg === null || arg === undefined) return '';
            if (typeof arg === 'object') {
                try { return JSON.stringify(arg); } catch(e) { return String(arg); }
            }
            return String(arg);
        }).join(' ');
        
        return SENSITIVE_PATTERNS.some(pattern => pattern.test(text));
    }
    
    console.log = function() {
        if (containsSensitiveData(arguments)) return;
        return originalLog.apply(console, arguments);
    };
    
    console.warn = function() {
        if (containsSensitiveData(arguments)) return;
        return originalWarn.apply(console, arguments);
    };
    
    console.error = function() {
        if (containsSensitiveData(arguments)) return;
        return originalError.apply(console, arguments);
    };
    
    console.debug = console.log;
    console.info = console.log;
    
    console.log('[🔒] Security active - Keys hidden');
})();

// ============================================
// EMAIL VALIDATION HELPER
// ============================================
class EmailValidator {
    static validate(email) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    }

    static normalize(email) {
        return email.toLowerCase().trim();
    }

    static getDomain(email) {
        return email.split('@')[1];
    }

    static isGmail(email) {
        return this.getDomain(email) === 'gmail.com';
    }
}

// ============================================
// ENVIRONMENT CONFIGURATION HELPER - FIXED v2
// ============================================
class EnvironmentConfig {
    constructor() {
        this.isVercel = this.detectVercel();
        this.firebaseConfig = null;
        this.configLoaded = false;
    }

    detectVercel() {
        return typeof window !== 'undefined' && 
               (window.location.hostname.includes('vercel.app') || 
                window.location.hostname.includes('vercel'));
    }

    async waitForEnv() {
        return new Promise((resolve) => {
            if (typeof window.ENV !== 'undefined' && 
                window.ENV.NEXT_PUBLIC_FIREBASE_API_KEY && 
                !window.ENV.NEXT_PUBLIC_FIREBASE_API_KEY.includes('%')) {
                console.log('[Environment] Environment variables found');
                resolve();
                return;
            }
            
            window.addEventListener('env-loaded', () => resolve(), { once: true });
            
            setTimeout(() => {
                console.log('[Environment] Timeout - using CONFIG fallback');
                resolve();
            }, 1000);
        });
    }

    loadFirebaseConfig() {
        console.log('[Environment] Loading Firebase config...');

        let apiKey = null;
        let projectId = null;
        
        try {
            apiKey = getEnv('NEXT_PUBLIC_FIREBASE_API_KEY');
            projectId = getEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
        } catch (e) {
            console.log('[Environment] getEnv not available');
        }

        const isValidEnvValue = (val) => {
            return val && 
                   typeof val === 'string' && 
                   val.length > 10 && 
                   !val.includes('%') &&
                   val !== 'your-firebase-api-key-here' &&
                   val !== 'your-project-id';
        };

        if (isValidEnvValue(apiKey) && isValidEnvValue(projectId)) {
            console.log('[Environment] ✅ Using Environment Variables');
            
            const config = {
                apiKey: apiKey,
                authDomain: getEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN') || `${projectId}.firebaseapp.com`,
                projectId: projectId,
                storageBucket: getEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET') || `${projectId}.appspot.com`,
                messagingSenderId: getEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
                appId: getEnv('NEXT_PUBLIC_FIREBASE_APP_ID'),
                measurementId: getEnv('NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID')
            };
            
            this.configLoaded = true;
            return config;
        }

        console.log('[Environment] ⚠️ Using CONFIG fallback (local values)');
        console.log('[Environment] API Key:', CONFIG.FIREBASE.API_KEY ? '✅ Set' : '❌ Missing');
        console.log('[Environment] Project ID:', CONFIG.FIREBASE.PROJECT_ID);
        
        this.configLoaded = true;
        return {
            apiKey: CONFIG.FIREBASE.API_KEY,
            authDomain: CONFIG.FIREBASE.AUTH_DOMAIN,
            projectId: CONFIG.FIREBASE.PROJECT_ID,
            storageBucket: CONFIG.FIREBASE.STORAGE_BUCKET,
            messagingSenderId: CONFIG.FIREBASE.MESSAGING_SENDER_ID,
            appId: CONFIG.FIREBASE.APP_ID,
            measurementId: CONFIG.FIREBASE.MEASUREMENT_ID
        };
    }

    isValidConfig(config) {
        const valid = config && 
               config.apiKey && 
               config.apiKey !== 'your-firebase-api-key-here' &&
               config.apiKey.length > 10 &&
               config.projectId && 
               config.projectId !== 'your-project-id';
        
        console.log('[Environment] Config valid:', valid);
        if (!valid) {
            console.error('[Environment] ❌ Invalid config:', {
                hasApiKey: !!config.apiKey,
                apiKeyLength: config.apiKey?.length,
                projectId: config.projectId
            });
        }
        return valid;
    }
}

// ============================================
// FIREBASE MANAGER - EMAIL AUTHENTICATION VERSION
// ============================================
class FirebaseManager {
    constructor() {
        this.app = null;
        this.db = null;
        this.auth = null;
        this.isInitialized = false;
        this.syncListeners = new Map();
        this.offlineQueue = [];
        this.isOnline = navigator.onLine;
        this.syncEnabled = false;
        this.initPromise = null;
        this.initialLoadComplete = false;
        this.listenersSetup = false;
        this.authRetryCount = 0;
        this.maxAuthRetries = 3;

        this.initPromise = this.init();
    }

    async init() {
        try {
            console.log('[Firebase] Starting initialization...');

            await envConfig.waitForEnv();
            const firebaseConfig = envConfig.loadFirebaseConfig();

            if (!envConfig.isValidConfig(firebaseConfig)) {
                console.error('[Firebase] Invalid configuration');
                this.isInitialized = false;
                this.syncEnabled = false;
                return false;
            }

            console.log('[Firebase] Config valid, initializing...');

            if (typeof firebase === 'undefined') {
                console.error('[Firebase] Firebase SDK not loaded!');
                return false;
            }

            if (!firebase.apps.length) {
                this.app = firebase.initializeApp(firebaseConfig);
                console.log('[Firebase] App initialized');
            } else {
                this.app = firebase.app();
                console.log('[Firebase] Using existing app');
            }

            this.db = firebase.firestore();

            try {
                await this.db.enablePersistence({ 
                    synchronizeTabs: true
                });
                console.log('[Firebase] ✅ Multi-tab persistence enabled');
            } catch (err) {
                if (err.code === 'failed-precondition') {
                    console.warn('[Firebase] Persistence enabled in another tab');
                } else {
                    console.warn('[Firebase] Persistence error:', err);
                }
            }

            this.auth = firebase.auth();

            this.setupNetworkListeners();
            this.loadOfflineQueue();

            this.setupAuthStateListener();

            this.isInitialized = true;
            this.syncEnabled = CONFIG.FIREBASE.SYNC.ENABLED;

            console.log('[Firebase] ✅ Initialized successfully');

            console.log('[Firebase] 🔄 Loading initial data from server...');
            await this.loadInitialDataFromServer();
            this.initialLoadComplete = true;
            console.log('[Firebase] ✅ Initial data load complete');

            this.setupRealtimeListeners();
            this.setupAutoSync();

            return true;

        } catch (error) {
            console.error('[Firebase] ❌ Initialization error:', error);
            this.isInitialized = false;
            this.syncEnabled = false;
            return false;
        }
    }

    setupAuthStateListener() {
        this.auth.onAuthStateChanged((user) => {
            if (user) {
                console.log('[Firebase] Auth state: signed in as', user.email);
                if (!user.emailVerified) {
                    console.log('[Firebase] Email not verified');
                }
            } else {
                console.log('[Firebase] Auth state: signed out');
            }
        });
    }

    // ============================================
    // EMAIL AUTHENTICATION METHODS
    // ============================================
    
    async signUpWithEmail(email, password, name) {
        try {
            const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            await user.updateProfile({
                displayName: name
            });

            await user.sendEmailVerification();

            console.log('[Firebase] ✅ User created and verification email sent:', email);
            
            return {
                success: true,
                user: {
                    uid: user.uid,
                    email: user.email,
                    name: name,
                    emailVerified: user.emailVerified
                },
                message: 'Verification email sent. Please check your inbox.'
            };
        } catch (error) {
            console.error('[Firebase] Sign up error:', error);
            return {
                success: false,
                error: this.getAuthErrorMessage(error),
                code: error.code
            };
        }
    }

    async signInWithEmail(email, password) {
        try {
            const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            if (!user.emailVerified) {
                console.log('[Firebase] User signed in but email not verified');
                return {
                    success: false,
                    needsVerification: true,
                    user: {
                        uid: user.uid,
                        email: user.email,
                        name: user.displayName,
                        emailVerified: false
                    },
                    message: 'Please verify your email before logging in. Check your inbox.'
                };
            }

            console.log('[Firebase] ✅ User signed in:', email);
            
            return {
                success: true,
                user: {
                    uid: user.uid,
                    email: user.email,
                    name: user.displayName,
                    emailVerified: true
                }
            };
        } catch (error) {
            console.error('[Firebase] Sign in error:', error);
            return {
                success: false,
                error: this.getAuthErrorMessage(error),
                code: error.code
            };
        }
    }

    async sendPasswordResetEmail(email) {
        try {
            await this.auth.sendPasswordResetEmail(email);
            console.log('[Firebase] ✅ Password reset email sent:', email);
            return {
                success: true,
                message: 'Password reset email sent. Please check your inbox.'
            };
        } catch (error) {
            console.error('[Firebase] Password reset error:', error);
            return {
                success: false,
                error: this.getAuthErrorMessage(error),
                code: error.code
            };
        }
    }

    async verifyEmail(actionCode) {
        try {
            await this.auth.applyActionCode(actionCode);
            console.log('[Firebase] ✅ Email verified');
            return {
                success: true,
                message: 'Email verified successfully. You can now log in.'
            };
        } catch (error) {
            console.error('[Firebase] Email verification error:', error);
            return {
                success: false,
                error: this.getAuthErrorMessage(error),
                code: error.code
            };
        }
    }

    async resendVerificationEmail() {
        try {
            const user = this.auth.currentUser;
            if (user) {
                await user.sendEmailVerification();
                return {
                    success: true,
                    message: 'Verification email resent. Please check your inbox.'
                };
            }
            return {
                success: false,
                error: 'No user is currently signed in.'
            };
        } catch (error) {
            return {
                success: false,
                error: this.getAuthErrorMessage(error),
                code: error.code
            };
        }
    }

    async updateEmail(newEmail) {
        try {
            const user = this.auth.currentUser;
            if (user) {
                await user.updateEmail(newEmail);
                await user.sendEmailVerification();
                return {
                    success: true,
                    message: 'Email updated. Please verify your new email.'
                };
            }
            return {
                success: false,
                error: 'No user is currently signed in.'
            };
        } catch (error) {
            return {
                success: false,
                error: this.getAuthErrorMessage(error),
                code: error.code
            };
        }
    }

    async updatePassword(newPassword) {
        try {
            const user = this.auth.currentUser;
            if (user) {
                await user.updatePassword(newPassword);
                return {
                    success: true,
                    message: 'Password updated successfully.'
                };
            }
            return {
                success: false,
                error: 'No user is currently signed in.'
            };
        } catch (error) {
            return {
                success: false,
                error: this.getAuthErrorMessage(error),
                code: error.code
            };
        }
    }

    async signOut() {
        try {
            await this.auth.signOut();
            console.log('[Firebase] ✅ User signed out');
            return { success: true };
        } catch (error) {
            console.error('[Firebase] Sign out error:', error);
            return {
                success: false,
                error: this.getAuthErrorMessage(error)
            };
        }
    }

    getAuthErrorMessage(error) {
        const errorMessages = {
            'auth/invalid-email': 'Invalid email address format.',
            'auth/user-disabled': 'This account has been disabled.',
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password.',
            'auth/email-already-in-use': 'An account already exists with this email.',
            'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
            'auth/invalid-action-code': 'The link is invalid or expired.',
            'auth/expired-action-code': 'The link has expired.',
            'auth/requires-recent-login': 'Please log in again to complete this action.',
            'auth/too-many-requests': 'Too many attempts. Please try again later.',
            'auth/network-request-failed': 'Network error. Please check your connection.',
            'auth/invalid-credential': 'Invalid credentials provided.',
            'auth/operation-not-allowed': 'This operation is not allowed. Please contact support.'
        };
        
        return errorMessages[error.code] || error.message || 'An error occurred. Please try again.';
    }

    // ============================================
    // EXISTING FIRESTORE METHODS (unchanged)
    // ============================================

    async loadInitialDataFromServer() {
        if (!this.isInitialized || !this.db) {
            console.log('[Firebase] Cannot load data - not initialized');
            return;
        }

        console.log('[Firebase] 🔄 Loading initial data from server...');

        const collections = [
            { name: CONFIG.FIREBASE.COLLECTIONS.USERS, key: 'users' },
            { name: CONFIG.FIREBASE.COLLECTIONS.FREE_MACS, key: 'macs' },
            { name: CONFIG.FIREBASE.COLLECTIONS.FREE_XTREAMS, key: 'xtreams' },
            { name: CONFIG.FIREBASE.COLLECTIONS.TICKETS, key: 'tickets' },
            { name: CONFIG.FIREBASE.COLLECTIONS.IPTV_APPS, key: 'apps' }
        ];

        for (const col of collections) {
            try {
                console.log(`[Firebase] Fetching ${col.name}...`);
                const snapshot = await this.db.collection(col.name).get({ source: 'server' });

                if (!snapshot.empty) {
                    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    console.log(`[Firebase] ✅ Loaded ${docs.length} ${col.key}`);
                    this.updateLocalData(col.key, docs);
                }
            } catch (err) {
                console.error(`[Firebase] ❌ Error loading ${col.name}:`, err);
            }
        }

        try {
            const telegramDoc = await this.db.collection(CONFIG.FIREBASE.COLLECTIONS.TELEGRAM_LINKS).doc('main').get({ source: 'server' });
            if (telegramDoc.exists) {
                console.log('[Firebase] ✅ Loaded telegram links');
                this.updateLocalTelegramLinks(telegramDoc.data());
            }
        } catch (err) {
            console.error('[Firebase] ❌ Error loading telegram links:', err);
        }

        this.initialLoadComplete = true;
        console.log('[Firebase] ✅ Initial data load complete');
    }

    updateLocalData(type, remoteData) {
        try {
            switch(type) {
                case 'users': this.updateLocalUsers(remoteData); break;
                case 'macs': this.updateLocalMACs(remoteData); break;
                case 'xtreams': this.updateLocalXtreams(remoteData); break;
                case 'tickets': this.updateLocalTickets(remoteData); break;
                case 'apps': this.updateLocalApps(remoteData); break;
            }
        } catch (error) {
            console.error(`[Firebase] Error updating ${type}:`, error);
        }
    }

    updateLocalUsers(remoteUsers) {
        if (typeof userManager === 'undefined') return;

        try {
            const localUsers = userManager.users || [];
            
            const processedUsers = remoteUsers.map(remoteUser => {
                const localUser = localUsers.find(u => u.id == remoteUser.id);
                
                return {
                    ...remoteUser,
                    id: parseInt(remoteUser.id) || remoteUser.id,
                    email: remoteUser.email || localUser?.email,
                    emailVerified: remoteUser.emailVerified ?? localUser?.emailVerified ?? false
                };
            });

            const hasChanges = JSON.stringify(userManager.users) !== JSON.stringify(processedUsers);

            if (hasChanges) {
                console.log('[Firebase] Updating users:', processedUsers.length);
                userManager.users = processedUsers;

                // ✅ Update nextUserId to avoid ID conflicts
                const numericIds = processedUsers.map(u => parseInt(u.id)).filter(id => !isNaN(id));
                const maxId = Math.max(...numericIds, 0);
                if (maxId >= userManager.nextUserId) {
                    userManager.nextUserId = maxId + 1;
                    localStorage.setItem(CONFIG.STORAGE_KEYS.NEXT_USER_ID, userManager.nextUserId);
                }

                securityManager.secureStore(CONFIG.STORAGE_KEYS.USERS, processedUsers);

                if (document.getElementById('user-management-section')?.style.display !== 'none') {
                    updateUsersTable();
                }
            }
        } catch (error) {
            console.error('[Firebase] Error updating users:', error);
        }
    }

    updateLocalMACs(remoteMACs) {
        if (typeof macManager === 'undefined') return;

        try {
            const processedMACs = remoteMACs.map(d => ({
                id: parseInt(d.id) || d.id,
                url: d.url,
                macAddress: d.macAddress,
                expiryDate: d.expiryDate,
                created: d.created,
                createdBy: d.createdBy
            }));

            const hasChanges = JSON.stringify(macManager.macs) !== JSON.stringify(processedMACs);

            if (hasChanges) {
                console.log('[Firebase] Updating MACs:', processedMACs.length);
                macManager.macs = processedMACs;
                securityManager.secureStore(CONFIG.STORAGE_KEYS.FREE_MACS, processedMACs);

                if (document.getElementById('free-mac-section')?.style.display !== 'none') {
                    updateFreeMACCards();
                }
            }
        } catch (error) {
            console.error('[Firebase] Error updating MACs:', error);
        }
    }

    updateLocalXtreams(remoteXtreams) {
        if (typeof xtreamManager === 'undefined') return;

        try {
            const processedXtreams = remoteXtreams.map(d => ({
                id: parseInt(d.id) || d.id,
                url: d.url,
                username: d.username,
                password: d.password,
                expiryDate: d.expiryDate,
                created: d.created,
                createdBy: d.createdBy
            }));

            const hasChanges = JSON.stringify(xtreamManager.xtreams) !== JSON.stringify(processedXtreams);

            if (hasChanges) {
                console.log('[Firebase] Updating Xtreams:', processedXtreams.length);
                xtreamManager.xtreams = processedXtreams;
                securityManager.secureStore(CONFIG.STORAGE_KEYS.FREE_XTREAMS, processedXtreams);

                if (document.getElementById('free-xtream-section')?.style.display !== 'none') {
                    updateFreeXtreamCards();
                }
            }
        } catch (error) {
            console.error('[Firebase] Error updating Xtreams:', error);
        }
    }

    updateLocalTickets(remoteTickets) {
        if (typeof ticketManager === 'undefined') return;

        try {
            const processedTickets = remoteTickets.map(d => ({
                id: parseInt(d.id) || d.id,
                subject: d.subject,
                category: d.category,
                priority: d.priority,
                description: d.description,
                status: d.status,
                createdBy: d.createdBy,
                createdAt: d.createdAt,
                updatedAt: d.updatedAt,
                messages: d.messages || []
            }));

            const hasChanges = JSON.stringify(ticketManager.tickets) !== JSON.stringify(processedTickets);

            if (hasChanges) {
                console.log('[Firebase] Updating tickets:', processedTickets.length);
                ticketManager.tickets = processedTickets;
                securityManager.secureStore(CONFIG.STORAGE_KEYS.TICKETS, processedTickets);

                if (document.getElementById('ticket-section')?.style.display !== 'none' ||
                    document.getElementById('ticket-detail-section')?.style.display !== 'none') {
                    updateTicketsList();
                }
            }
        } catch (error) {
            console.error('[Firebase] Error updating tickets:', error);
        }
    }

    updateLocalApps(remoteApps) {
        if (typeof iptvAppsManager === 'undefined') return;

        try {
            const processedApps = remoteApps.map(d => ({
                id: parseInt(d.id) || d.id,
                name: d.name,
                downloadUrl: d.downloadUrl,
                created: d.created,
                createdBy: d.createdBy,
                updated: d.updated
            }));

            const hasChanges = JSON.stringify(iptvAppsManager.apps) !== JSON.stringify(processedApps);

            if (hasChanges) {
                console.log('[Firebase] Updating apps:', processedApps.length);
                iptvAppsManager.apps = processedApps;
                securityManager.secureStore(CONFIG.STORAGE_KEYS.IPTV_APPS, processedApps);

                if (document.getElementById('iptv-apps-section')?.style.display !== 'none') {
                    updateIPTVAppsCards();
                }
            }
        } catch (error) {
            console.error('[Firebase] Error updating apps:', error);
        }
    }

    updateLocalTelegramLinks(data) {
        if (typeof telegramManager === 'undefined' || !data) return;

        try {
            telegramManager.links = {
                group: data.group || telegramManager.links?.group || '',
                channel: data.channel || telegramManager.links?.channel || '',
                contact: data.contact || telegramManager.links?.contact || ''
            };
            securityManager.secureStore(CONFIG.STORAGE_KEYS.TELEGRAM_LINKS, telegramManager.links);

            if (document.getElementById('telegram-section')?.style.display !== 'none') {
                updateTelegramCards();
            }
        } catch (error) {
            console.error('[Firebase] Error updating telegram links:', error);
        }
    }

    setupRealtimeListeners() {
        if (!this.isInitialized || !this.db || this.listenersSetup) {
            return;
        }

        console.log('[Firebase] Setting up real-time listeners...');

        const setupListener = (collection, key, handler) => {
            try {
                return this.db.collection(collection)
                    .onSnapshot({ includeMetadataChanges: true }, (snapshot) => {
                        const hasServerChanges = snapshot.docChanges().some(change => 
                            !change.doc.metadata.fromCache || change.doc.metadata.hasPendingWrites
                        );

                        if (hasServerChanges) {
                            console.log(`[Firebase] ${key} updated from server`);
                            handler(snapshot);
                        }
                    }, (error) => {
                        console.error(`[Firebase] ${key} listener error:`, error);
                    });
            } catch (err) {
                console.error(`[Firebase] Failed to setup ${key} listener:`, err);
                return null;
            }
        };

        this.unsubscribeUsers = setupListener(
            CONFIG.FIREBASE.COLLECTIONS.USERS, 
            'Users', 
            (snapshot) => this.handleCollectionChange('users', snapshot)
        );

        this.unsubscribeMACs = setupListener(
            CONFIG.FIREBASE.COLLECTIONS.FREE_MACS, 
            'MACs', 
            (snapshot) => this.handleCollectionChange('macs', snapshot)
        );

        this.unsubscribeXtreams = setupListener(
            CONFIG.FIREBASE.COLLECTIONS.FREE_XTREAMS, 
            'Xtreams', 
            (snapshot) => this.handleCollectionChange('xtreams', snapshot)
        );

        this.unsubscribeTickets = setupListener(
            CONFIG.FIREBASE.COLLECTIONS.TICKETS, 
            'Tickets', 
            (snapshot) => this.handleCollectionChange('tickets', snapshot)
        );

        this.unsubscribeApps = setupListener(
            CONFIG.FIREBASE.COLLECTIONS.IPTV_APPS, 
            'Apps', 
            (snapshot) => this.handleCollectionChange('apps', snapshot)
        );

        try {
            this.unsubscribeTelegram = this.db.collection(CONFIG.FIREBASE.COLLECTIONS.TELEGRAM_LINKS)
                .doc('main')
                .onSnapshot({ includeMetadataChanges: true }, (doc) => {
                    if (doc.exists && (!doc.metadata.fromCache || doc.metadata.hasPendingWrites)) {
                        console.log('[Firebase] Telegram links updated');
                        this.updateLocalTelegramLinks(doc.data());
                    }
                }, (error) => {
                    console.error('[Firebase] Telegram listener error:', error);
                });
        } catch (err) {
            console.error('[Firebase] Failed to setup Telegram listener:', err);
        }

        this.listenersSetup = true;
        console.log('[Firebase] ✅ Real-time listeners setup complete');
    }

    handleCollectionChange(type, snapshot) {
        try {
            const changes = snapshot.docChanges();
            let hasDeletions = false;
            
            changes.forEach((change) => {
                if (change.type === 'removed') {
                    hasDeletions = true;
                    console.log(`[Firebase] Document removed from ${type}:`, change.doc.id);
                }
            });

            const docs = [];
            snapshot.forEach((doc) => {
                docs.push({ id: doc.id, ...doc.data() });
            });

            console.log(`[Firebase] ${type} updated: ${docs.length} documents`);
            
            this.updateLocalData(type, docs);
            
        } catch (error) {
            console.error(`[Firebase] Error handling ${type} change:`, error);
        }
    }

    setupNetworkListeners() {
        window.addEventListener('online', async () => {
            this.isOnline = true;
            console.log('[Firebase] 🌐 Connection restored');
            await this.loadInitialDataFromServer();
            await this.processOfflineQueue();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('[Firebase] 📴 Connection lost');
        });
    }

    setupAutoSync() {
        setInterval(() => {
            if (this.shouldSync()) {
                this.processOfflineQueue();
            }
        }, CONFIG.FIREBASE.SYNC.SYNC_INTERVAL || 30000);

        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden && this.shouldSync()) {
                console.log('[Firebase] Tab visible, refreshing data...');
                await this.loadInitialDataFromServer();
            }
        });
    }

    async ensureInitialized() {
        if (this.initPromise) {
            await this.initPromise;
        }
        return this.isInitialized;
    }

    shouldSync() {
        return this.isInitialized && this.isOnline && this.syncEnabled;
    }

    // Sync methods for Firestore (unchanged)
    async syncUser(userData) {
        await this.ensureInitialized();
        if (!this.shouldSync()) {
            this.queueOperation('syncUser', userData);
            return { success: false, offline: true };
        }

        try {
            // ✅ Ensure id is a number for Firestore rules
            const numericId = parseInt(userData.id);
            const userRef = this.db.collection(CONFIG.FIREBASE.COLLECTIONS.USERS)
                                  .doc(userData.id.toString());

            // Prepare data with numeric id
            const dataToSync = {
                ...userData,
                id: isNaN(numericId) ? userData.id : numericId  // Use numeric id if valid
            };
            
            const safeUserData = { ...userData };
            delete safeUserData.password;

            await userRef.set({
                ...dataToSync,
                lastSync: firebase.firestore.FieldValue.serverTimestamp(),
                syncDevice: navigator.userAgent
            }, { merge: true });

            console.log('[Firebase] User synced:', userData.id);
            return { success: true };
        } catch (error) {
            console.error('[Firebase] User sync error:', error);
            this.queueOperation('syncUser', userData);
            return { success: false, error: error.message };
        }
    }

    async deleteUser(userId) {
        await this.ensureInitialized();
        if (!this.shouldSync()) {
            this.queueOperation('deleteUser', { userId });
            return { success: false, offline: true };
        }

        try {
            await this.db.collection(CONFIG.FIREBASE.COLLECTIONS.USERS)
                        .doc(userId.toString()).delete();
            console.log('[Firebase] User deleted:', userId);
            return { success: true };
        } catch (error) {
            console.error('[Firebase] Delete user error:', error);
            this.queueOperation('deleteUser', { userId });
            return { success: false, error: error.message };
        }
    }

    async syncMAC(macData) {
        await this.ensureInitialized();
        if (!this.shouldSync()) {
            this.queueOperation('syncMAC', macData);
            return { success: false, offline: true };
        }

        try {
            const macRef = this.db.collection(CONFIG.FIREBASE.COLLECTIONS.FREE_MACS)
                                 .doc(macData.id.toString());
            await macRef.set({
                ...macData,
                lastSync: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return { success: true };
        } catch (error) {
            this.queueOperation('syncMAC', macData);
            return { success: false, error: error.message };
        }
    }

    async deleteMAC(macId) {
        await this.ensureInitialized();
        if (!this.shouldSync()) {
            this.queueOperation('deleteMAC', { macId });
            return { success: false, offline: true };
        }

        try {
            await this.db.collection(CONFIG.FIREBASE.COLLECTIONS.FREE_MACS)
                        .doc(macId.toString()).delete();
            return { success: true };
        } catch (error) {
            this.queueOperation('deleteMAC', { macId });
            return { success: false, error: error.message };
        }
    }

    async syncXtream(xtreamData) {
        await this.ensureInitialized();
        if (!this.shouldSync()) {
            this.queueOperation('syncXtream', xtreamData);
            return { success: false, offline: true };
        }

        try {
            const xtreamRef = this.db.collection(CONFIG.FIREBASE.COLLECTIONS.FREE_XTREAMS)
                                    .doc(xtreamData.id.toString());
            await xtreamRef.set({
                ...xtreamData,
                lastSync: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return { success: true };
        } catch (error) {
            this.queueOperation('syncXtream', xtreamData);
            return { success: false, error: error.message };
        }
    }

    async deleteXtream(xtreamId) {
        await this.ensureInitialized();
        if (!this.shouldSync()) {
            this.queueOperation('deleteXtream', { xtreamId });
            return { success: false, offline: true };
        }

        try {
            await this.db.collection(CONFIG.FIREBASE.COLLECTIONS.FREE_XTREAMS)
                        .doc(xtreamId.toString()).delete();
            return { success: true };
        } catch (error) {
            this.queueOperation('deleteXtream', { xtreamId });
            return { success: false, error: error.message };
        }
    }

    async syncTicket(ticketData) {
        await this.ensureInitialized();
        if (!this.shouldSync()) {
            this.queueOperation('syncTicket', ticketData);
            return { success: false, offline: true };
        }

        try {
            const ticketRef = this.db.collection(CONFIG.FIREBASE.COLLECTIONS.TICKETS)
                                    .doc(ticketData.id.toString());
            await ticketRef.set({
                ...ticketData,
                lastSync: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return { success: true };
        } catch (error) {
            this.queueOperation('syncTicket', ticketData);
            return { success: false, error: error.message };
        }
    }

    async deleteTicket(ticketId) {
        await this.ensureInitialized();
        if (!this.shouldSync()) {
            this.queueOperation('deleteTicket', { ticketId });
            return { success: false, offline: true };
        }

        try {
            await this.db.collection(CONFIG.FIREBASE.COLLECTIONS.TICKETS)
                        .doc(ticketId.toString()).delete();
            return { success: true };
        } catch (error) {
            this.queueOperation('deleteTicket', { ticketId });
            return { success: false, error: error.message };
        }
    }

    async syncApp(appData) {
        await this.ensureInitialized();
        if (!this.shouldSync()) {
            this.queueOperation('syncApp', appData);
            return { success: false, offline: true };
        }

        try {
            const appRef = this.db.collection(CONFIG.FIREBASE.COLLECTIONS.IPTV_APPS)
                                .doc(appData.id.toString());
            await appRef.set({
                ...appData,
                lastSync: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return { success: true };
        } catch (error) {
            this.queueOperation('syncApp', appData);
            return { success: false, error: error.message };
        }
    }

    async deleteApp(appId) {
        await this.ensureInitialized();
        if (!this.shouldSync()) {
            this.queueOperation('deleteApp', { appId });
            return { success: false, offline: true };
        }

        try {
            await this.db.collection(CONFIG.FIREBASE.COLLECTIONS.IPTV_APPS)
                        .doc(appId.toString()).delete();
            return { success: true };
        } catch (error) {
            this.queueOperation('deleteApp', { appId });
            return { success: false, error: error.message };
        }
    }

    async syncTelegramLinks(linksData) {
        await this.ensureInitialized();
        if (!this.shouldSync()) {
            this.queueOperation('syncTelegramLinks', linksData);
            return { success: false, offline: true };
        }

        try {
            const linksRef = this.db.collection(CONFIG.FIREBASE.COLLECTIONS.TELEGRAM_LINKS)
                                   .doc('main');
            await linksRef.set({
                ...linksData,
                lastSync: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return { success: true };
        } catch (error) {
            this.queueOperation('syncTelegramLinks', linksData);
            return { success: false, error: error.message };
        }
    }

    queueOperation(operation, data) {
        const queueItem = {
            operation,
            data,
            timestamp: Date.now(),
            retryCount: 0
        };
        this.offlineQueue.push(queueItem);
        this.saveOfflineQueue();
        console.log(`[Firebase] Queued: ${operation}`);
    }

    async processOfflineQueue() {
        if (this.offlineQueue.length === 0) return;

        console.log(`[Firebase] Processing ${this.offlineQueue.length} queued operations`);
        const failedOperations = [];

        for (const item of this.offlineQueue) {
            try {
                let result;
                switch (item.operation) {
                    case 'syncUser': result = await this.syncUser(item.data); break;
                    case 'deleteUser': result = await this.deleteUser(item.data.userId); break;
                    case 'syncMAC': result = await this.syncMAC(item.data); break;
                    case 'deleteMAC': result = await this.deleteMAC(item.data.macId); break;
                    case 'syncXtream': result = await this.syncXtream(item.data); break;
                    case 'deleteXtream': result = await this.deleteXtream(item.data.xtreamId); break;
                    case 'syncTicket': result = await this.syncTicket(item.data); break;
                    case 'deleteTicket': result = await this.deleteTicket(item.data.ticketId); break;
                    case 'syncApp': result = await this.syncApp(item.data); break;
                    case 'deleteApp': result = await this.deleteApp(item.data.appId); break;
                    case 'syncTelegramLinks': result = await this.syncTelegramLinks(item.data); break;
                    default: continue;
                }

                if (!result || !result.success) {
                    item.retryCount++;
                    if (item.retryCount < 3) {
                        failedOperations.push(item);
                    }
                }
            } catch (error) {
                item.retryCount++;
                if (item.retryCount < 3) {
                    failedOperations.push(item);
                }
            }
        }

        this.offlineQueue = failedOperations;
        this.saveOfflineQueue();
    }

    saveOfflineQueue() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.FIREBASE_SYNC_QUEUE, 
                                JSON.stringify(this.offlineQueue));
        } catch (e) {
            console.error('[Firebase] Failed to save offline queue:', e);
        }
    }

    loadOfflineQueue() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.FIREBASE_SYNC_QUEUE);
            if (saved) {
                this.offlineQueue = JSON.parse(saved);
                console.log(`[Firebase] Loaded ${this.offlineQueue.length} queued operations`);
            }
        } catch (e) {
            console.error('[Firebase] Failed to load offline queue:', e);
            this.offlineQueue = [];
        }
    }

    getSyncStatus() {
        return {
            isInitialized: this.isInitialized,
            isOnline: this.isOnline,
            syncEnabled: this.syncEnabled,
            pendingOperations: this.offlineQueue.length,
            initialLoadComplete: this.initialLoadComplete,
            listenersSetup: this.listenersSetup
        };
    }
}

const envConfig = new EnvironmentConfig();
const firebaseManager = new FirebaseManager();

// ============================================
// SMART DELAY MANAGER (unchanged)
// ============================================
class SmartDelayManager {
    constructor() {
        this.attempts = new Map();
        this.loadFromStorage();
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.SMART_DELAY);
            if (saved) {
                const parsed = JSON.parse(atob(saved));
                this.attempts = new Map(Object.entries(parsed));
            }
        } catch (e) {
            console.error('Smart delay load error:', e);
        }
    }

    saveToStorage() {
        try {
            const obj = Object.fromEntries(this.attempts);
            localStorage.setItem(CONFIG.STORAGE_KEYS.SMART_DELAY, btoa(JSON.stringify(obj)));
        } catch (e) {
            console.error('Smart delay save error:', e);
        }
    }

    getDelay(identifier) {
        if (!CONFIG.SECURITY.SMART_DELAY.ENABLED) return 0;

        const now = Date.now();
        const attempt = this.attempts.get(identifier);

        if (!attempt) return 0;

        const windowMs = CONFIG.SECURITY.RATE_LIMIT.WINDOW_MS;
        if (now - attempt.lastAttempt > windowMs) {
            this.attempts.delete(identifier);
            this.saveToStorage();
            return 0;
        }

        const baseDelay = CONFIG.SECURITY.SMART_DELAY.BASE_DELAY_MS;
        const maxDelay = CONFIG.SECURITY.SMART_DELAY.MAX_DELAY_MS;
        const factor = CONFIG.SECURITY.SMART_DELAY.EXPONENTIAL_FACTOR;

        let delay = baseDelay * Math.pow(factor, attempt.count - 1);
        delay = Math.min(delay, maxDelay);

        const jitter = delay * CONFIG.SECURITY.SMART_DELAY.JITTER_PERCENTAGE;
        delay += (Math.random() * 2 - 1) * jitter;

        return Math.floor(delay);
    }

    recordAttempt(identifier) {
        const now = Date.now();
        const existing = this.attempts.get(identifier);

        if (existing) {
            existing.count++;
            existing.lastAttempt = now;
        } else {
            this.attempts.set(identifier, {
                count: 1,
                lastAttempt: now,
                firstAttempt: now
            });
        }

        this.saveToStorage();
        return this.getDelay(identifier);
    }

    resetAttempts(identifier) {
        this.attempts.delete(identifier);
        this.saveToStorage();
    }

    async executeWithDelay(identifier, operation) {
        const delay = this.getDelay(identifier);

        if (delay > 0) {
            console.log(`Smart delay: ${delay}ms for ${identifier}`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        try {
            const result = await operation();

            if (result && result.success) {
                this.resetAttempts(identifier);
            } else {
                this.recordAttempt(identifier);
            }

            return result;
        } catch (error) {
            this.recordAttempt(identifier);
            throw error;
        }
    }
}

// ============================================
// ENCRYPTED LOGGING SYSTEM (unchanged)
// ============================================
class EncryptedLogger {
    constructor() {
        this.logs = [];
        this.encryptionKey = null;
        this.initialized = false;
        this.init();
    }

    async init() {
        await this.loadOrCreateKey();
        await this.loadLogs();
        this.initialized = true;

        setInterval(() => this.flush(), CONFIG.SECURITY.LOGGING.AUTO_FLUSH_INTERVAL);
    }

    async loadOrCreateKey() {
        try {
            let keyData = localStorage.getItem(CONFIG.STORAGE_KEYS.LOG_ENCRYPTION_KEY);

            if (!keyData) {
                const key = await crypto.subtle.generateKey(
                    {
                        name: 'AES-GCM',
                        length: CONFIG.SECURITY.LOGGING.ENCRYPTION_KEY_LENGTH
                    },
                    true,
                    ['encrypt', 'decrypt']
                );

                const exported = await crypto.subtle.exportKey('raw', key);
                keyData = btoa(String.fromCharCode(...new Uint8Array(exported)));
                localStorage.setItem(CONFIG.STORAGE_KEYS.LOG_ENCRYPTION_KEY, keyData);
                this.encryptionKey = key;
            } else {
                const keyBuffer = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
                this.encryptionKey = await crypto.subtle.importKey(
                    'raw',
                    keyBuffer,
                    { name: 'AES-GCM' },
                    false,
                    ['encrypt', 'decrypt']
                );
            }
        } catch (e) {
            console.error('Encryption key error:', e);
            this.encryptionKey = null;
        }
    }

    async encrypt(data) {
        if (!this.encryptionKey) return btoa(JSON.stringify(data));

        try {
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encoded = new TextEncoder().encode(JSON.stringify(data));

            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                this.encryptionKey,
                encoded
            );

            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);

            return btoa(String.fromCharCode(...combined));
        } catch (e) {
            console.error('Encryption error:', e);
            return btoa(JSON.stringify(data));
        }
    }

    async decrypt(encryptedData) {
        if (!this.encryptionKey) return JSON.parse(atob(encryptedData));

        try {
            const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
            const iv = combined.slice(0, 12);
            const data = combined.slice(12);

            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                this.encryptionKey,
                data
            );

            return JSON.parse(new TextDecoder().decode(decrypted));
        } catch (e) {
            console.error('Decryption error:', e);
            return null;
        }
    }

    sanitizeSensitiveData(data) {
        if (typeof data !== 'object' || data === null) return data;

        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            const lowerKey = key.toLowerCase();
            const isSensitive = CONFIG.SECURITY.LOGGING.SENSITIVE_FIELDS.some(
                field => lowerKey.includes(field.toLowerCase())
            );

            if (isSensitive) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'object') {
                sanitized[key] = this.sanitizeSensitiveData(value);
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }

    async log(level, eventType, details, userId = null) {
        if (!CONFIG.SECURITY.LOGGING.ENABLED) return;

        const entry = {
            timestamp: new Date().toISOString(),
            level: level,
            eventType: eventType,
            details: this.sanitizeSensitiveData(details),
            userId: userId,
            userAgent: navigator.userAgent,
            url: window.location.href,
            sessionId: this.getSessionId()
        };

        this.logs.push(entry);

        if (this.logs.length > CONFIG.SECURITY.LOGGING.MAX_LOG_ENTRIES) {
            this.logs = this.logs.slice(-CONFIG.SECURITY.LOGGING.MAX_LOG_ENTRIES);
        }

        if (level === 'critical' || level === 'error') {
            await this.flush();
        }
    }

    getSessionId() {
        try {
            const session = sessionStorage.getItem(CONFIG.STORAGE_KEYS.SESSION_DATA);
            if (session) {
                const parsed = JSON.parse(session);
                return parsed.userId || 'anonymous';
            }
        } catch (e) {}
        return 'anonymous';
    }

    async flush() {
        if (this.logs.length === 0) return;

        try {
            const encrypted = await this.encrypt(this.logs);
            localStorage.setItem(CONFIG.STORAGE_KEYS.ENCRYPTED_LOGS, encrypted);
            this.logs = [];
        } catch (e) {
            console.error('Log flush error:', e);
        }
    }

    async loadLogs() {
        try {
            const encrypted = localStorage.getItem(CONFIG.STORAGE_KEYS.ENCRYPTED_LOGS);
            if (encrypted) {
                const decrypted = await this.decrypt(encrypted);
                if (decrypted && Array.isArray(decrypted)) {
                    this.logs = decrypted;
                }
            }
        } catch (e) {
            console.error('Log load error:', e);
        }
    }

    async getLogs(filter = {}) {
        await this.flush();

        let allLogs = [...this.logs];

        try {
            const encrypted = localStorage.getItem(CONFIG.STORAGE_KEYS.ENCRYPTED_LOGS);
            if (encrypted) {
                const decrypted = await this.decrypt(encrypted);
                if (decrypted && Array.isArray(decrypted)) {
                    allLogs = [...decrypted, ...allLogs];
                }
            }
        } catch (e) {}

        if (filter.level) {
            allLogs = allLogs.filter(log => log.level === filter.level);
        }
        if (filter.eventType) {
            allLogs = allLogs.filter(log => log.eventType === filter.eventType);
        }
        if (filter.userId) {
            allLogs = allLogs.filter(log => log.userId === filter.userId);
        }
        if (filter.startDate) {
            allLogs = allLogs.filter(log => new Date(log.timestamp) >= new Date(filter.startDate));
        }
        if (filter.endDate) {
            allLogs = allLogs.filter(log => new Date(log.timestamp) <= new Date(filter.endDate));
        }

        return allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    async clearLogs() {
        this.logs = [];
        localStorage.removeItem(CONFIG.STORAGE_KEYS.ENCRYPTED_LOGS);
    }

    info(eventType, details, userId) {
        return this.log('info', eventType, details, userId);
    }

    warning(eventType, details, userId) {
        return this.log('warning', eventType, details, userId);
    }

    error(eventType, details, userId) {
        return this.log('error', eventType, details, userId);
    }

    critical(eventType, details, userId) {
        return this.log('critical', eventType, details, userId);
    }
}

// ============================================
// SECURE COOKIE MANAGER (unchanged)
// ============================================
class SecureCookieManager {
    constructor() {
        this.cookies = new Map();
        this.loadCookies();
    }

    loadCookies() {
        if (document.cookie) {
            document.cookie.split(';').forEach(cookie => {
                const [name, ...valueParts] = cookie.trim().split('=');
                const value = valueParts.join('=');
                try {
                    this.cookies.set(name, decodeURIComponent(value));
                } catch (e) {
                    this.cookies.set(name, value);
                }
            });
        }
    }

    set(name, value, options = {}) {
        const config = CONFIG.SECURITY.COOKIES;

        let cookieString = `${name}=${encodeURIComponent(value)}`;

        if (config.HTTP_ONLY) {
            cookieString += '; HttpOnly';
        }
        if (config.SECURE && window.location.protocol === 'https:') {
            cookieString += '; Secure';
        }
        if (config.SAME_SITE) {
            cookieString += `; SameSite=${config.SAME_SITE}`;
        }

        cookieString += `; Path=${options.path || config.PATH}`;

        if (options.maxAge !== undefined) {
            cookieString += `; Max-Age=${options.maxAge}`;
        } else if (config.MAX_AGE) {
            cookieString += `; Max-Age=${config.MAX_AGE}`;
        }

        if (options.expires) {
            cookieString += `; Expires=${options.expires.toUTCString()}`;
        }

        document.cookie = cookieString;
        this.cookies.set(name, value);

        return true;
    }

    get(name) {
        this.loadCookies();
        return this.cookies.get(name);
    }

    remove(name, path = '/') {
        document.cookie = `${name}=; Path=${path}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0`;
        this.cookies.delete(name);
    }

    setSessionCookie(sessionData) {
        const encrypted = btoa(JSON.stringify(sessionData));
        return this.set('session', encrypted, { 
            maxAge: CONFIG.SECURITY.SESSION.TIMEOUT / 1000 
        });
    }

    getSessionCookie() {
        const session = this.get('session');
        if (session) {
            try {
                return JSON.parse(atob(session));
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    removeSessionCookie() {
        this.remove('session');
    }

    setCSRFCookie(token) {
        return this.set('csrf_token', token, { 
            maxAge: 86400
        });
    }

    getCSRFCookie() {
        return this.get('csrf_token');
    }

    setConsentCookie(consented) {
        return this.set('cookie_consent', consented ? '1' : '0', {
            maxAge: 31536000
        });
    }

    getConsentCookie() {
        return this.get('cookie_consent') === '1';
    }

    clearAll() {
        const cookiesToKeep = ['cookie_consent'];

        this.cookies.forEach((value, name) => {
            if (!cookiesToKeep.includes(name)) {
                this.remove(name);
            }
        });
    }
}

// ============================================
// SECURITY MANAGER (unchanged)
// ============================================
class SecurityManager {
    constructor() {
        this.csrfToken = null;
        this.sessionId = null;
        this.failedAttempts = new Map();
        this.smartDelay = new SmartDelayManager();
        this.encryptedLogger = new EncryptedLogger();
        this.cookieManager = new SecureCookieManager();
        this.init();
    }

    async init() {
        this.generateCSRFToken();
        this.setupXSSProtection();
        this.setupClickjackingProtection();

        while (!this.encryptedLogger.initialized) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    async hashPassword(password, salt = null) {
        try {
            if (!salt) {
                salt = this.generateSalt();
            }

            const encoder = new TextEncoder();
            const passwordBuffer = encoder.encode(password);
            const saltBuffer = this.hexToBuffer(salt);

            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                passwordBuffer,
                { name: 'PBKDF2' },
                false,
                ['deriveBits']
            );

            const keyLengthBits = CONFIG.SECURITY.PBKDF2.KEY_LENGTH * 8;

            const hashBuffer = await crypto.subtle.deriveBits(
                {
                    name: 'PBKDF2',
                    salt: saltBuffer,
                    iterations: CONFIG.SECURITY.PBKDF2.ITERATIONS,
                    hash: CONFIG.SECURITY.PBKDF2.HASH
                },
                keyMaterial,
                keyLengthBits
            );

            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            console.log('[hashPassword] Generated hash length:', hashHex.length, 'chars');
            console.log('[hashPassword] Salt:', salt);

            return {
                hash: hashHex,
                salt: salt
            };
        } catch (error) {
            console.error('[hashPassword] Error:', error);
            await this.encryptedLogger.error('PASSWORD_HASH_ERROR', { error: error.message });
            throw new Error('Failed to hash password');
        }
    }

    async verifyPassword(password, hash, salt) {
        try {
            if (!hash || !salt) {
                console.error('[verifyPassword] Missing hash or salt:', { hash, salt });
                return false;
            }

            console.log('[verifyPassword] Input hash:', hash);
            console.log('[verifyPassword] Input salt:', salt);
            
            const result = await this.hashPassword(password, salt);
            
            console.log('[verifyPassword] Generated hash:', result.hash);
            console.log('[verifyPassword] Hashes equal:', result.hash === hash);
            
            return this.timingSafeEqual(result.hash, hash);
        } catch (error) {
            console.error('[verifyPassword] Error:', error);
            return false;
        }
    }

    timingSafeEqual(a, b) {
        if (!a || !b) {
            console.warn('[timingSafeEqual] One of the values is null/undefined:', { a, b });
            return false;
        }
        
        if (a.length !== b.length) {
            console.warn('[timingSafeEqual] Length mismatch:', a.length, 'vs', b.length);
            return false;
        }
        
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
    }

    generateSalt() {
        const array = new Uint8Array(CONFIG.SECURITY.PBKDF2.SALT_LENGTH);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    hexToBuffer(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes.buffer;
    }

    generateCSRFToken() {
        const array = new Uint8Array(CONFIG.SECURITY.CSRF.TOKEN_LENGTH);
        crypto.getRandomValues(array);
        this.csrfToken = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

        try {
            sessionStorage.setItem(CONFIG.STORAGE_KEYS.CSRF_TOKEN, this.csrfToken);
            this.cookieManager.setCSRFCookie(this.csrfToken);
        } catch (e) {
            console.warn('Could not store CSRF token');
        }

        return this.csrfToken;
    }

    validateCSRFToken(token) {
        const cookieToken = this.cookieManager.getCSRFCookie();
        const sessionToken = this.csrfToken;

        return token && (token === sessionToken || token === cookieToken);
    }

    sanitizeInput(input) {
        if (typeof input !== 'string') {
            return input;
        }

        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    sanitizeURL(url) {
        if (typeof url !== 'string') {
            return url;
        }
        return url
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    sanitizeObject(obj) {
        if (typeof obj === 'string') {
            return this.sanitizeInput(obj);
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item));
        }
        if (obj && typeof obj === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                sanitized[key] = this.sanitizeObject(value);
            }
            return sanitized;
        }
        return obj;
    }

    validateInput(input, type = 'string') {
        const patterns = {
            sql: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT|ONERROR)\b)|(--|\/\*|\*\/|\|)/i,
            nosql: /(\$\{|\$where|\$ne|\$gt|\$lt|\$gte|\$lte|\$in|\$nin|\$regex|\$options)/,
            xss: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            path: /(\.\.\/|\.\.\\|%2e%2e%2f|%252e%252e%252f)/i,
            command: /[;&|`$(){}[\]\\]/
        };

        if (typeof input !== 'string') {
            return { valid: true, sanitized: input };
        }

        for (const [attack, pattern] of Object.entries(patterns)) {
            if (pattern.test(input)) {
                console.warn(`Potential ${attack.toUpperCase()} injection detected:`, input);
                this.encryptedLogger.warning('INJECTION_ATTEMPT', { 
                    type: attack, 
                    input: input.substring(0, 50) + '...' 
                });
                return { valid: false, error: `Invalid characters detected` };
            }
        }

        return { valid: true, sanitized: this.sanitizeInput(input) };
    }

    validateURL(url) {
        if (typeof url !== 'string') {
            return { valid: false, error: 'URL must be a string' };
        }

        const patterns = {
            sql: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT|ONERROR)\b)|(--|\/\*|\*\/|\|)/i,
            nosql: /(\$\{|\$where|\$ne|\$gt|\$lt|\$gte|\$lte|\$in|\$nin|\$regex|\$options)/,
            xss: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            command: /[;&|`$(){}[\]\\]/
        };

        for (const [attack, pattern] of Object.entries(patterns)) {
            if (pattern.test(url)) {
                console.warn(`Potential ${attack.toUpperCase()} injection detected in URL:`, url);
                this.encryptedLogger.warning('INJECTION_ATTEMPT', { 
                    type: attack, 
                    input: url.substring(0, 50) + '...' 
                });
                return { valid: false, error: `Invalid characters detected` };
            }
        }

        return { valid: true, sanitized: this.sanitizeURL(url.trim()) };
    }

    checkRateLimit(identifier) {
        const now = Date.now();
        const key = `rate_${identifier}`;

        try {
            const stored = localStorage.getItem(key);
            let attempts = stored ? JSON.parse(stored) : { count: 0, firstAttempt: now, blocked: false };

            if (attempts.blocked) {
                if (now - attempts.firstAttempt > CONFIG.SECURITY.RATE_LIMIT.BLOCK_DURATION_MS) {
                    attempts = { count: 0, firstAttempt: now, blocked: false };
                } else {
                    const remaining = Math.ceil((CONFIG.SECURITY.RATE_LIMIT.BLOCK_DURATION_MS - (now - attempts.firstAttempt)) / 60000);
                    return { allowed: false, message: `Too many attempts. Try again in ${remaining} minutes.` };
                }
            }

            if (now - attempts.firstAttempt > CONFIG.SECURITY.RATE_LIMIT.WINDOW_MS) {
                attempts = { count: 0, firstAttempt: now, blocked: false };
            }

            attempts.count++;

            if (attempts.count >= CONFIG.SECURITY.RATE_LIMIT.MAX_ATTEMPTS) {
                attempts.blocked = true;
                localStorage.setItem(key, JSON.stringify(attempts));
                this.encryptedLogger.warning('RATE_LIMIT_BLOCK', { identifier: identifier });
                return { allowed: false, message: `Too many failed attempts. Account locked for 30 minutes.` };
            }

            localStorage.setItem(key, JSON.stringify(attempts));
            return { allowed: true, remaining: CONFIG.SECURITY.RATE_LIMIT.MAX_ATTEMPTS - attempts.count };
        } catch (e) {
            console.error('Rate limit check error:', e);
            return { allowed: true };
        }
    }

    resetRateLimit(identifier) {
        try {
            localStorage.removeItem(`rate_${identifier}`);
        } catch (e) {
            console.error('Rate limit reset error:', e);
        }
    }

    setupXSSProtection() {
        const originalSetAttribute = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function(name, value) {
            if (name.toLowerCase().startsWith('on')) {
                console.warn('Blocked inline event handler:', name);
                return;
            }
            return originalSetAttribute.call(this, name, value);
        };
    }

    setupClickjackingProtection() {
        if (window.top !== window.self) {
            console.warn('Page is being framed - potential clickjacking attempt');
        }

        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.password-input, .secure-field')) {
                e.preventDefault();
            }
        }, true);
    }

    createSession(userId) {
        const session = {
            userId: userId,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            csrfToken: this.csrfToken
        };

        try {
            sessionStorage.setItem(CONFIG.STORAGE_KEYS.SESSION_DATA, JSON.stringify(session));
            this.cookieManager.setSessionCookie(session);
        } catch (e) {
            console.error('Session creation error:', e);
        }

        return session;
    }

    validateSession() {
        try {
            let session = this.cookieManager.getSessionCookie();

            if (!session) {
                const sessionData = sessionStorage.getItem(CONFIG.STORAGE_KEYS.SESSION_DATA);
                if (sessionData) {
                    session = JSON.parse(sessionData);
                }
            }

            if (!session) return null;

            const now = Date.now();

            if (now - session.lastActivity > CONFIG.SECURITY.SESSION.TIMEOUT) {
                this.destroySession();
                return null;
            }

            session.lastActivity = now;
            sessionStorage.setItem(CONFIG.STORAGE_KEYS.SESSION_DATA, JSON.stringify(session));
            this.cookieManager.setSessionCookie(session);

            return session;
        } catch (e) {
            console.error('Session validation error:', e);
            return null;
        }
    }

    destroySession() {
        try {
            sessionStorage.removeItem(CONFIG.STORAGE_KEYS.SESSION_DATA);
            sessionStorage.removeItem(CONFIG.STORAGE_KEYS.CSRF_TOKEN);
            this.cookieManager.removeSessionCookie();
            this.csrfToken = null;
        } catch (e) {
            console.error('Session destruction error:', e);
        }
    }

    secureStore(key, data) {
        try {
            const jsonData = JSON.stringify(data);
            const encoded = btoa(unescape(encodeURIComponent(jsonData)));
            localStorage.setItem(key, encoded);
        } catch (e) {
            console.error('Secure storage error:', e);
        }
    }

    secureRetrieve(key) {
        try {
            const encoded = localStorage.getItem(key);
            if (!encoded) return null;
            const jsonData = decodeURIComponent(escape(atob(encoded)));
            return JSON.parse(jsonData);
        } catch (e) {
            console.error('Secure retrieve error:', e);
            return null;
        }
    }

    async logSecurityEvent(eventType, details) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: eventType,
            details: details,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        await this.encryptedLogger.info(eventType, details);

        try {
            let logs = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.SECURITY_LOG) || '[]');
            logs.push(logEntry);
            if (logs.length > 100) logs = logs.slice(-100);
            localStorage.setItem(CONFIG.STORAGE_KEYS.SECURITY_LOG, JSON.stringify(logs));
        } catch (e) {
            console.error('Security logging error:', e);
        }
    }
}

const securityManager = new SecurityManager();

// ============================================
// NOTIFICATION SYSTEM (unchanged)
// ============================================
class GlassNotification {
    constructor() {
        this.container = document.getElementById('notificationContainer');
        this.notificationId = 0;
    }

    show(title, message, type = 'info', duration = 5, position = 'right') {
        this.notificationId++;
        const id = `notification-${this.notificationId}`;

        const notification = document.createElement('div');
        notification.id = id;
        notification.className = `notification ${type}`;

        let iconClass;
        switch(type) {
            case 'success':
                iconClass = 'fas fa-check-circle';
                break;
            case 'error':
                iconClass = 'fas fa-exclamation-circle';
                break;
            case 'warning':
                iconClass = 'fas fa-exclamation-triangle';
                break;
            case 'info':
            default:
                iconClass = 'fas fa-info-circle';
                break;
        }

        let progressBar = '';
        if (duration > 0) {
            progressBar = `<div class="notification-progress active" style="animation-duration: ${duration}s"></div>`;
        }

        const safeTitle = securityManager.sanitizeInput(title);
        const safeMessage = securityManager.sanitizeInput(message);

        notification.innerHTML = `
            <div class="notification-icon">
                <i class="${iconClass}"></i>
            </div>
            <div class="notification-title">
                ${safeTitle}
            </div>
            <div class="notification-message">${safeMessage}</div>
            <div class="notification-close" data-notification-id="${id}">
                <i class="fas fa-times"></i>
            </div>
            ${progressBar}
        `;

        this.container.appendChild(notification);

        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.hide(id);
        });

        if (duration > 0) {
            setTimeout(() => {
                if (document.getElementById(id)) {
                    this.hide(id);
                }
            }, duration * 1000);
        }

        return this.notificationId;
    }

    hide(id) {
        const notification = document.getElementById(id);
        if (notification) {
            notification.classList.add('hiding');

            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 400);
        }
    }

    hideAll() {
        const notifications = this.container.querySelectorAll('.notification');
        notifications.forEach(notification => {
            this.hide(notification.id);
        });
    }

    success(title, message, duration = 5, position = 'right') {
        return this.show(title, message, 'success', duration, position);
    }

    error(title, message, duration = 5, position = 'right') {
        return this.show(title, message, 'error', duration, position);
    }

    warning(title, message, duration = 5, position = 'right') {
        return this.show(title, message, 'warning', duration, position);
    }

    info(title, message, duration = 5, position = 'right') {
        return this.show(title, message, 'info', duration, position);
    }
}

// ============================================
// USER MANAGEMENT - EMAIL AUTHENTICATION VERSION
// ============================================
class UserManagement {
    constructor() {
        this.users = [];
        this.permissions = JSON.parse(JSON.stringify(CONFIG.PERMISSIONS));
        this.currentUser = null;
        this.nextUserId = 4;
        this.initialized = false;

        this.init();
    }

    async init() {
        await this.initializeDefaultUsers();
        this.loadFromStorage();
        this.initialized = true;
    }

    async initializeDefaultUsers() {
        const savedUsers = localStorage.getItem(CONFIG.STORAGE_KEYS.USERS);

        // ✅ Clean up duplicate owners and migrate to name-based ID
        if (savedUsers) {
            let users = JSON.parse(atob(savedUsers));

            // Find owner by name (new system) or by old numeric ID
            const ownerByName = users.find(u => u.id === 'ahmedtech' || u.id === 'AHMEDTECH');
            const ownerByNumber = users.find(u => u.id === 1 || u.id === '1');

            if (ownerByName && ownerByNumber) {
                // Remove the numeric ID owner, keep the name-based one
                console.log('[UserManagement] Removing duplicate owner with numeric ID');
                users = users.filter(u => !(u.id === 1 || u.id === '1'));

                // Save cleaned users
                securityManager.secureStore(CONFIG.STORAGE_KEYS.USERS, users);
            }

            // Load existing users
            this.users = users;

            // Check if owner exists with name ID
            const ownerExists = this.users.some(u => 
                u.role === 'owner' && (u.id === 'ahmedtech' || u.id === 'AHMEDTECH')
            );

            if (ownerExists) {
                console.log('[UserManagement] Owner exists with name ID');
                return;
            }

            // If owner exists with old ID, migrate it
            const oldOwner = this.users.find(u => u.id === 1 || u.id === '1');
            if (oldOwner) {
                console.log('[UserManagement] Migrating owner to name ID');
                oldOwner.id = 'ahmedtech';
                await this.saveToStorage();
                return;
            }
        }

        // Create default owner with name ID
        const defaultUsers = JSON.parse(JSON.stringify(CONFIG.DEFAULT_USERS));

        for (const user of defaultUsers) {
            const defaultPassword = CONFIG.DEFAULT_PASSWORDS[user.email];
            if (defaultPassword) {
                const hashed = await securityManager.hashPassword(defaultPassword);
                user.passwordHash = hashed.hash;
                user.salt = hashed.salt;
                user.password = null;
            }
        }

        this.users = defaultUsers;
        await this.saveToStorage();
    }

    // ============================================
    // EMAIL-BASED AUTHENTICATION METHODS
    // ============================================

    async login(email, password) {
        return securityManager.smartDelay.executeWithDelay(
            `login_${EmailValidator.normalize(email)}`,
            async () => {
                console.log('[login] Attempting login for:', email);
                
                // Validate email format
                if (!EmailValidator.validate(email)) {
                    await securityManager.logSecurityEvent('LOGIN_ATTEMPT_INVALID_EMAIL', { email: '[REDACTED]' });
                    return { success: false, message: "Please enter a valid email address" };
                }

                const normalizedEmail = EmailValidator.normalize(email);

                const rateCheck = securityManager.checkRateLimit(normalizedEmail);
                if (!rateCheck.allowed) {
                    await securityManager.logSecurityEvent('LOGIN_RATE_LIMITED', { email: normalizedEmail });
                    return { success: false, message: rateCheck.message };
                }

                // Use Firebase Authentication
                if (firebaseManager.isInitialized) {
                    const result = await firebaseManager.signInWithEmail(normalizedEmail, password);
                    
                    if (result.success) {
                        // Find or create local user record
                        let localUser = this.users.find(u => u.email === normalizedEmail);
                        
                        if (!localUser) {
                            // ✅ Generate ID from email username (sanitized)
                            const userId = normalizedEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_');

                            // Check if ID exists
                            let finalId = userId;
                            let counter = 1;
                            while (this.users.some(u => u.id === finalId)) {
                                finalId = `${userId}_${counter}`;
                                counter++;
                            }

                            // Create local record for Firebase user
                            localUser = {
                                id: finalId,  // ✅ ID from email username
                                name: result.user.name || normalizedEmail.split('@')[0],
                                email: normalizedEmail,
                                role: 'user',
                                created: new Date().toISOString(),
                                banned: false,
                                lastLogin: new Date().toISOString(),
                                loginAttempts: 0,
                                lockedUntil: null,
                                emailVerified: result.user.emailVerified,
                                uid: result.user.uid
                            };
                            this.users.push(localUser);
                        } else {
                            localUser.lastLogin = new Date().toISOString();
                            localUser.emailVerified = result.user.emailVerified;
                            localUser.uid = result.user.uid;
                        }

                        if (localUser.banned) {
                            await firebaseManager.signOut();
                            await securityManager.logSecurityEvent('LOGIN_ATTEMPT_BANNED', { 
                                email: normalizedEmail, 
                                userId: localUser.id 
                            });
                            return { success: false, message: "This account has been banned" };
                        }

                        this.currentUser = localUser;
                        securityManager.resetRateLimit(normalizedEmail);
                        securityManager.smartDelay.resetAttempts(`login_${normalizedEmail}`);
                        securityManager.createSession(localUser.id);
                        await this.saveToStorage();

                        await securityManager.logSecurityEvent('LOGIN_SUCCESS', { 
                            email: normalizedEmail, 
                            userId: localUser.id, 
                            role: localUser.role 
                        });

                        return { 
                            success: true, 
                            user: { 
                                id: localUser.id,
                                name: localUser.name,
                                email: localUser.email,
                                role: localUser.role,
                                created: localUser.created,
                                banned: localUser.banned,
                                emailVerified: localUser.emailVerified
                            }
                        };
                    } else if (result.needsVerification) {
                        return { 
                            success: false, 
                            message: result.message,
                            needsVerification: true,
                            email: normalizedEmail
                        };
                    } else {
                        await securityManager.logSecurityEvent('LOGIN_FAILED', { 
                            email: normalizedEmail,
                            reason: result.error 
                        });
                        return { success: false, message: result.error };
                    }
                } else {
                    // Fallback to local authentication if Firebase not available
                    return this.loginLocal(normalizedEmail, password);
                }
            }
        );
    }

    async loginLocal(email, password) {
        const user = this.users.find(u => u.email === email);
        
        console.log('[loginLocal] User found:', user ? 'YES' : 'NO');
        if (user) {
            console.log('[loginLocal] Stored hash:', user.passwordHash ? user.passwordHash.substring(0, 20) + '...' : 'NONE');
        }

        if (!user) {
            await securityManager.logSecurityEvent('LOGIN_FAILED_USER_NOT_FOUND', { email: email });
            return { success: false, message: "Invalid email or password" };
        }

        if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
            const remaining = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
            return { success: false, message: `Account locked. Try again in ${remaining} minutes.` };
        }

        if (user.banned) {
            await securityManager.logSecurityEvent('LOGIN_ATTEMPT_BANNED', { email: email, userId: user.id });
            return { success: false, message: "This account has been banned" };
        }

        const passwordValid = await securityManager.verifyPassword(password, user.passwordHash, user.salt);
        console.log('[loginLocal] Password valid:', passwordValid);

        if (!passwordValid) {
            user.loginAttempts = (user.loginAttempts || 0) + 1;

            if (user.loginAttempts >= CONFIG.SYSTEM.MAX_LOGIN_ATTEMPTS) {
                user.lockedUntil = new Date(Date.now() + CONFIG.SYSTEM.LOCKOUT_DURATION).toISOString();
                await securityManager.logSecurityEvent('ACCOUNT_LOCKED', { email: email, userId: user.id });
            }

            await this.saveToStorage();
            await securityManager.logSecurityEvent('LOGIN_FAILED_WRONG_PASSWORD', { email: email, userId: user.id });
            return { success: false, message: "Invalid email or password" };
        }

        user.loginAttempts = 0;
        user.lockedUntil = null;
        user.lastLogin = new Date().toISOString();
        this.currentUser = user;

        securityManager.resetRateLimit(email);
        securityManager.smartDelay.resetAttempts(`login_${email}`);

        securityManager.createSession(user.id);

        await this.saveToStorage();
        await securityManager.logSecurityEvent('LOGIN_SUCCESS', { 
            email: email, 
            userId: user.id, 
            role: user.role 
        });

        return { success: true, user: { 
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            created: user.created,
            banned: user.banned,
            emailVerified: user.emailVerified || false
        }};
    }

    async register(name, email, password, role = 'user') {
        console.log('[register] Starting registration for:', email);
        
        // Validate email format
        if (!EmailValidator.validate(email)) {
            return { success: false, message: "Please enter a valid email address" };
        }

        const normalizedEmail = EmailValidator.normalize(email);

        // Check if email already exists
        if (this.users.some(u => u.email === normalizedEmail)) {
            return { success: false, message: "An account already exists with this email" };
        }

        if (password.length < CONFIG.SYSTEM.MIN_PASSWORD_LENGTH) {
            return { success: false, message: `Password must be at least ${CONFIG.SYSTEM.MIN_PASSWORD_LENGTH} characters` };
        }

        if (this.currentUser) {
            const canCreateRole = this.canPerformAction('create_user') && 
                                 this.canPerformAction('change_role');

            if (role !== 'user' && !canCreateRole) {
                await securityManager.logSecurityEvent('UNAUTHORIZED_ROLE_ASSIGNMENT', { 
                    attemptedBy: this.currentUser.email,
                    attemptedRole: role 
                });
                return { success: false, message: "You don't have permission to create this role" };
            }
        } else {
            role = 'user';
        }

        // Use Firebase Authentication
        if (firebaseManager.isInitialized) {
            const result = await firebaseManager.signUpWithEmail(normalizedEmail, password, name);
            
            if (result.success) {
                // ✅ Generate ID from name (sanitized)
                const userId = securityManager.sanitizeInput(name).trim().replace(/\s+/g, '_').toLowerCase();

                // Check if ID already exists
                if (this.users.some(u => u.id === userId)) {
                    return { success: false, message: "A user with this name already exists" };
                }

                const newUser = {
                    id: userId,  // ✅ ID is the user's name
                    name: securityManager.sanitizeInput(name).trim(),
                    email: normalizedEmail,
                    role: role,
                    created: new Date().toISOString(),
                    banned: false,
                    lastLogin: null,
                    loginAttempts: 0,
                    lockedUntil: null,
                    emailVerified: false,
                    uid: result.user.uid
                };

                this.users.push(newUser);
                await this.saveToStorage();

                await securityManager.logSecurityEvent('USER_REGISTERED', { 
                    email: normalizedEmail, 
                    userId: newUser.id,
                    role: role,
                    createdBy: this.currentUser ? this.currentUser.email : 'self'
                });

                return { 
                    success: true, 
                    user: {
                        id: newUser.id,
                        name: newUser.name,
                        email: newUser.email,
                        role: newUser.role
                    },
                    message: result.message
                };
            } else {
                return { success: false, message: result.error };
            }
        } else {
            // Fallback to local registration
            return this.registerLocal(name, normalizedEmail, password, role);
        }
    }

    async registerLocal(name, email, password, role) {
        let hashed;
        try {
            hashed = await securityManager.hashPassword(password);
            console.log('[registerLocal] Password hashed successfully:', hashed.hash.substring(0, 20) + '...');
        } catch (error) {
            console.error('[registerLocal] Hashing failed:', error);
            return { success: false, message: "Password processing failed" };
        }

        // ✅ ID is now the user's name (sanitized)
        const userId = securityManager.sanitizeInput(name).trim().replace(/\s+/g, '_').toLowerCase();

        // Check if ID already exists
        if (this.users.some(u => u.id === userId)) {
            return { success: false, message: "A user with this name already exists" };
        }

        const newUser = {
            id: userId,  // ✅ ID is the user's name
            name: securityManager.sanitizeInput(name).trim(),
            email: email,
            password: null,
            passwordHash: hashed.hash,
            salt: hashed.salt,
            role: role,
            created: new Date().toISOString(),
            banned: false,
            lastLogin: null,
            loginAttempts: 0,
            lockedUntil: null,
            emailVerified: false
        };

        this.users.push(newUser);
        await this.saveToStorage();
        
        console.log('[registerLocal] User saved successfully:', newUser.id);

        await securityManager.logSecurityEvent('USER_REGISTERED', { 
            email: email, 
            userId: newUser.id,
            role: role,
            createdBy: this.currentUser ? this.currentUser.email : 'self'
        });

        return { success: true, user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role
        }};
    }

    async resendVerificationEmail() {
        if (firebaseManager.isInitialized) {
            const result = await firebaseManager.resendVerificationEmail();
            return result;
        }
        return { success: false, message: 'Email verification not available in offline mode' };
    }

    async sendPasswordReset(email) {
        if (!EmailValidator.validate(email)) {
            return { success: false, message: "Please enter a valid email address" };
        }

        const normalizedEmail = EmailValidator.normalize(email);

        if (firebaseManager.isInitialized) {
            const result = await firebaseManager.sendPasswordResetEmail(normalizedEmail);
            return result;
        }

        // Local fallback - just log the attempt
        await securityManager.logSecurityEvent('PASSWORD_RESET_REQUESTED', { email: normalizedEmail });
        return { 
            success: true, 
            message: 'If an account exists with this email, you will receive password reset instructions.' 
        };
    }

    async logout() {
        if (this.currentUser) {
            securityManager.logSecurityEvent('LOGOUT', { 
                email: this.currentUser.email, 
                userId: this.currentUser.id 
            });
        }

        if (firebaseManager.isInitialized) {
            await firebaseManager.signOut();
        }

        this.currentUser = null;
        securityManager.destroySession();
        securityManager.cookieManager.clearAll();
        this.saveToStorage();
        return { success: true };
    }

    canPerformAction(permissionId) {
        if (!this.currentUser) return false;
        if (this.currentUser.role === 'owner') return true;

        const rolePermissions = this.permissions[this.currentUser.role] || [];
        const permission = rolePermissions.find(p => p.id === permissionId);

        return permission ? permission.allowed : false;
    }

    getCurrentUserPermissions() {
        if (!this.currentUser) return [];
        return this.permissions[this.currentUser.role] || [];
    }

    getAllUsers() {
        if (!this.canPerformAction('view_all_users')) {
            return { success: false, message: "You don't have permission to view all users" };
        }

        return { success: true, users: this.users.map(u => ({ 
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            created: u.created,
            banned: u.banned,
            lastLogin: u.lastLogin,
            emailVerified: u.emailVerified || false
        })) };
    }

    getUserStats() {
        const totalUsers = this.users.length;
        const activeUsers = this.users.filter(u => !u.banned).length;
        const verifiedUsers = this.users.filter(u => u.emailVerified).length;

        return {
            total: totalUsers,
            active: activeUsers,
            verified: verifiedUsers
        };
    }

    getUserById(id) {
        // ✅ FIXED: Flexible comparison for both string and numeric IDs
        return this.users.find(u => 
            u.id === id || 
            u.id === parseInt(id) || 
            String(u.id) === String(id)
        );
    }

    getUserByEmail(email) {
        return this.users.find(u => u.email === EmailValidator.normalize(email));
    }

    async updateUser(id, data) {
        // ✅ FIXED: Flexible ID comparison (case-insensitive)
        const searchId = String(id).toLowerCase().trim();
        const userIndex = this.users.findIndex(u => {
            if (!u.id) return false;
            return String(u.id).toLowerCase().trim() === searchId;
        });

        if (userIndex === -1) {
            return { success: false, message: "User not found" };
        }

        // ✅ STRONG PROTECTION: Main owner account can only be modified by itself
        if (this.users[userIndex].id === 'ahmedtech' && this.currentUser.id !== 'ahmedtech') {
            console.log('[updateUser] Blocked modification of main owner account by other user');
            await securityManager.logSecurityEvent('UNAUTHORIZED_OWNER_MODIFICATION', { 
                attemptedBy: this.currentUser.email,
                targetUserId: id 
            });
            return { success: false, message: "❌ Protected Account: Only the owner (ahmedtech) can modify his own account." };
        }

        if (data.role && !this.canPerformAction('change_role')) {
            return { success: false, message: "You don't have permission to change user roles" };
        }

        if (data.name) {
            const validation = securityManager.validateInput(data.name, 'string');
            if (!validation.valid) return { success: false, message: "Invalid name" };
            this.users[userIndex].name = validation.sanitized.trim();
        }

        if (data.email) {
            if (!EmailValidator.validate(data.email)) {
                return { success: false, message: "Invalid email format" };
            }
            const newEmail = EmailValidator.normalize(data.email);

            if (this.users.some((u, idx) => u.email === newEmail && idx !== userIndex)) {
                return { success: false, message: "Email already in use" };
            }

            // ✅ Only update Firebase Auth email if the user is the current logged-in user
            // Cannot update other users' email from client-side
            if (firebaseManager.isInitialized && this.users[userIndex].uid) {
                // Skip Firebase Auth update for other users - only update local/Firestore
                console.log('[UserManagement] Skipping Firebase Auth email update for other user');
            }

            this.users[userIndex].email = newEmail;
        }

        if (data.password) {
            if (data.password.length < CONFIG.SYSTEM.MIN_PASSWORD_LENGTH) {
                return { success: false, message: `Password must be at least ${CONFIG.SYSTEM.MIN_PASSWORD_LENGTH} characters` };
            }

            // ✅ Cannot update other users' password from client-side Firebase Auth
            // Only update local password hash
            console.log('[UserManagement] Updating local password only (Firebase Auth restriction)');

            const hashed = await securityManager.hashPassword(data.password);
            this.users[userIndex].passwordHash = hashed.hash;
            this.users[userIndex].salt = hashed.salt;
        }

        if (data.role) {
            this.users[userIndex].role = data.role;
        }

        await this.saveToStorage();

        await securityManager.logSecurityEvent('USER_UPDATED', { 
            updatedBy: this.currentUser.email,
            targetUserId: id,
            changes: Object.keys(data).join(', ')
        });

        return { success: true, user: {
            id: this.users[userIndex].id,
            name: this.users[userIndex].name,
            email: this.users[userIndex].email,
            role: this.users[userIndex].role,
            banned: this.users[userIndex].banned,
            emailVerified: this.users[userIndex].emailVerified || false
        }};
    }

    async deleteUser(id) {
        if (!this.canPerformAction('delete_user')) {
            return { success: false, message: "You don't have permission to delete users" };
        }

        // ✅ FIXED: Flexible ID comparison (case-insensitive)
        const searchId = String(id).toLowerCase().trim();
        const userIndex = this.users.findIndex(u => {
            if (!u.id) return false;
            return String(u.id).toLowerCase().trim() === searchId;
        });

        if (userIndex === -1) {
            return { success: false, message: "User not found" };
        }

        // ✅ PROTECTION: Prevent deletion of main owner account (both old numeric ID and new name-based ID)
        const targetUserId = this.users[userIndex].id;
        if (targetUserId === 1 || targetUserId === '1' || 
            targetUserId === 'ahmedtech' || targetUserId === 'AHMEDTECH') {
            return { success: false, message: "❌ Cannot delete the main owner account (ahmedtech)" };
        }

        if (this.users[userIndex].role === 'owner' && this.currentUser.role !== 'owner') {
            securityManager.logSecurityEvent('UNAUTHORIZED_OWNER_DELETION', { 
                attemptedBy: this.currentUser.email,
                targetUserId: id 
            });
            return { success: false, message: "Only owner can delete other owner accounts" };
        }

        if (this.users[userIndex].role === 'admin' && this.currentUser.role === 'admin') {
            return { success: false, message: "Admin cannot delete other admin accounts" };
        }

        const deletedEmail = this.users[userIndex].email;

        // Delete from Firebase Auth if available
        if (firebaseManager.isInitialized && this.users[userIndex].uid) {
            // Note: Deleting from Firebase Auth requires Admin SDK or user to be signed in
            // For now, we just delete from Firestore
        }

        // Delete from Firebase Firestore
        if (typeof firebaseManager !== 'undefined' && firebaseManager.isInitialized) {
            try {
                const fbResult = await firebaseManager.deleteUser(id);
                if (!fbResult.success && !fbResult.offline) {
                    console.error('[UserManagement] Firebase delete failed:', fbResult.error);
                    return { success: false, message: "Failed to delete from database: " + fbResult.error };
                }
                console.log('[UserManagement] ✅ User deleted from Firebase:', id);
            } catch (error) {
                console.error('[UserManagement] Firebase delete error:', error);
                return { success: false, message: "Database error: " + error.message };
            }
        }

        this.users.splice(userIndex, 1);

        try {
            securityManager.secureStore(CONFIG.STORAGE_KEYS.USERS, this.users);
            localStorage.setItem(CONFIG.STORAGE_KEYS.NEXT_USER_ID, this.nextUserId.toString());

            if (this.currentUser) {
                const safeUser = {
                    id: this.currentUser.id,
                    name: this.currentUser.name,
                    email: this.currentUser.email,
                    role: this.currentUser.role,
                    created: this.currentUser.created,
                    banned: this.currentUser.banned,
                    lastLogin: this.currentUser.lastLogin,
                    emailVerified: this.currentUser.emailVerified || false
                };
                securityManager.secureStore(CONFIG.STORAGE_KEYS.CURRENT_USER, safeUser);
            } else {
                localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
            }
        } catch (e) {
            console.error("Error saving to storage:", e);
        }

        securityManager.logSecurityEvent('USER_DELETED', { 
            deletedBy: this.currentUser.email,
            targetUserId: id,
            targetEmail: deletedEmail
        });

        return { success: true };
    }

    async banUser(id) {
        if (!this.canPerformAction('ban_user')) {
            return { success: false, message: "You don't have permission to ban users" };
        }

        // ✅ FIXED: Flexible ID comparison (case-insensitive)
        const searchId = String(id).toLowerCase().trim();
        const userIndex = this.users.findIndex(u => {
            if (!u.id) return false;
            return String(u.id).toLowerCase().trim() === searchId;
        });

        if (userIndex === -1) {
            console.error('[banUser] User not found for ID:', id);
            return { success: false, message: "User not found (ID: " + id + ")" };
        }

        const targetUser = this.users[userIndex];

        // ✅ RULE 1: Owner cannot ban himself
        if (targetUser.id === this.currentUser.id) {
            return { success: false, message: "❌ You cannot ban your own account" };
        }

        // ✅ RULE 2: Admin cannot ban another admin (only owner can)
        if (targetUser.role === 'admin' && this.currentUser.role === 'admin') {
            return { success: false, message: "❌ Admin cannot ban another admin account" };
        }

        if (targetUser.role === 'owner' && this.currentUser.role !== 'owner') {
            securityManager.logSecurityEvent('UNAUTHORIZED_OWNER_BAN', { 
                attemptedBy: this.currentUser.email,
                targetUserId: id 
            });
            return { success: false, message: "Only owner can ban other owner accounts" };
        }

        if (targetUser.role === 'admin' && this.currentUser.role === 'admin') {
            return { success: false, message: "Admin cannot ban other admin accounts" };
        }

        if (this.users[userIndex].role === 'owner' && this.currentUser.role !== 'owner') {
            securityManager.logSecurityEvent('UNAUTHORIZED_OWNER_BAN', { 
                attemptedBy: this.currentUser.email,
                targetUserId: id 
            });
            return { success: false, message: "Only owner can ban other owner accounts" };
        }

        if (this.users[userIndex].role === 'admin' && this.currentUser.role === 'admin') {
            return { success: false, message: "Admin cannot ban other admin accounts" };
        }

        this.users[userIndex].banned = true;
        await this.saveToStorage();

        securityManager.logSecurityEvent('USER_BANNED', { 
            bannedBy: this.currentUser.email,
            targetUserId: id,
            targetEmail: this.users[userIndex].email
        });

        return { success: true, user: {
            id: this.users[userIndex].id,
            email: this.users[userIndex].email,
            banned: this.users[userIndex].banned
        }};
    }

    async unbanUser(id) {
        if (!this.canPerformAction('unban_user')) {
            return { success: false, message: "You don't have permission to unban users" };
        }

        // ✅ FIXED: Flexible ID comparison (case-insensitive)
        const searchId = String(id).toLowerCase().trim();
        const userIndex = this.users.findIndex(u => {
            if (!u.id) return false;
            return String(u.id).toLowerCase().trim() === searchId;
        });

        if (userIndex === -1) {
            console.error('[unbanUser] User not found for ID:', id);
            return { success: false, message: "User not found (ID: " + id + ")" };
        }

        const targetUser = this.users[userIndex];

        // ✅ RULE: Admin cannot unban another admin (only owner can)
        if (targetUser.role === 'admin' && this.currentUser.role === 'admin') {
            return { success: false, message: "❌ Admin cannot unban another admin account" };
        }

        if (targetUser.role === 'owner' && this.currentUser.role !== 'owner') {
            securityManager.logSecurityEvent('UNAUTHORIZED_OWNER_UNBAN', { 
                attemptedBy: this.currentUser.email,
                targetUserId: id 
            });
            return { success: false, message: "Only owner can unban other owner accounts" };
        }

        if (targetUser.role === 'admin' && this.currentUser.role === 'admin') {
            return { success: false, message: "Admin cannot unban other admin accounts" };
        }

        // ✅ Check permissions
        if (this.users[userIndex].role === 'owner' && this.currentUser.role !== 'owner') {
            securityManager.logSecurityEvent('UNAUTHORIZED_OWNER_UNBAN', { 
                attemptedBy: this.currentUser.email,
                targetUserId: id 
            });
            return { success: false, message: "Only owner can unban other owner accounts" };
        }

        if (this.users[userIndex].role === 'admin' && this.currentUser.role === 'admin') {
            return { success: false, message: "Admin cannot unban other admin accounts" };
        }

        this.users[userIndex].banned = false;
        await this.saveToStorage();

        securityManager.logSecurityEvent('USER_UNBANNED', { 
            unbannedBy: this.currentUser.email,
            targetUserId: id,
            targetEmail: this.users[userIndex].email
        });

        return { success: true, user: {
            id: this.users[userIndex].id,
            email: this.users[userIndex].email,
            banned: this.users[userIndex].banned
        }};
    }

    async changePassword(email, oldPassword, newPassword) {
        const user = this.users.find(u => u.email === EmailValidator.normalize(email));

        if (!user) {
            return { success: false, message: "Invalid email or old password" };
        }

        const oldPasswordValid = await securityManager.verifyPassword(oldPassword, user.passwordHash, user.salt);
        if (!oldPasswordValid) {
            await securityManager.logSecurityEvent('PASSWORD_CHANGE_FAILED', { 
                email: email,
                reason: 'Invalid old password'
            });
            return { success: false, message: "Invalid email or old password" };
        }

        if (this.currentUser && 
            this.currentUser.email !== email && 
            !this.canPerformAction('edit_user')) {
            return { success: false, message: "You don't have permission to change this password" };
        }

        if (newPassword.length < CONFIG.SYSTEM.MIN_PASSWORD_LENGTH) {
            return { success: false, message: `Password must be at least ${CONFIG.SYSTEM.MIN_PASSWORD_LENGTH} characters` };
        }

        // Update Firebase password if available
        if (firebaseManager.isInitialized && user.uid) {
            const result = await firebaseManager.updatePassword(newPassword);
            if (!result.success) {
                return { success: false, message: result.error };
            }
        }

        const hashed = await securityManager.hashPassword(newPassword);
        user.passwordHash = hashed.hash;
        user.salt = hashed.salt;

        await this.saveToStorage();

        await securityManager.logSecurityEvent('PASSWORD_CHANGED', { 
            email: email,
            changedBy: this.currentUser ? this.currentUser.email : 'self'
        });

        return { success: true };
    }

    async saveToStorage() {
        try {
            securityManager.secureStore(CONFIG.STORAGE_KEYS.USERS, this.users);
            localStorage.setItem(CONFIG.STORAGE_KEYS.NEXT_USER_ID, this.nextUserId.toString());

            if (this.currentUser) {
                const safeUser = {
                    id: this.currentUser.id,
                    name: this.currentUser.name,
                    email: this.currentUser.email,
                    role: this.currentUser.role,
                    created: this.currentUser.created,
                    banned: this.currentUser.banned,
                    lastLogin: this.currentUser.lastLogin,
                    emailVerified: this.currentUser.emailVerified || false
                };
                securityManager.secureStore(CONFIG.STORAGE_KEYS.CURRENT_USER, safeUser);
            } else {
                localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
            }

            if (typeof firebaseManager !== 'undefined') {
                await firebaseManager.ensureInitialized();
                
                if (firebaseManager.isInitialized) {
                    console.log('[UserManagement] Syncing to Firebase...');
                    
                    const syncPromises = this.users.map(user => 
                        firebaseManager.syncUser(user).catch(err => {
                            console.error('[UserManagement] Sync error for user', user.id, err);
                        })
                    );
                    
                    await Promise.all(syncPromises);
                    console.log('[UserManagement] ✅ Firebase sync complete');
                } else {
                    console.warn('[UserManagement] Firebase not initialized, data queued');
                }
            }
        } catch (e) {
            console.error("Error saving to storage:", e);
        }
    }

    loadFromStorage() {
        try {
            const savedUsers = securityManager.secureRetrieve(CONFIG.STORAGE_KEYS.USERS);
            const savedNextId = localStorage.getItem(CONFIG.STORAGE_KEYS.NEXT_USER_ID);
            const savedCurrentUser = securityManager.secureRetrieve(CONFIG.STORAGE_KEYS.CURRENT_USER);

            if (savedUsers) {
                this.users = savedUsers;
            }

            if (savedNextId) {
                this.nextUserId = parseInt(savedNextId);
            }

            if (savedCurrentUser) {
                const session = securityManager.validateSession();
                if (session) {
                    const fullUser = this.users.find(u => u.id === savedCurrentUser.id);
                    if (fullUser && !fullUser.banned) {
                        this.currentUser = fullUser;
                    } else {
                        this.currentUser = null;
                        securityManager.destroySession();
                    }
                } else {
                    this.currentUser = null;
                }
            }
        } catch (e) {
            console.error("Error loading from storage:", e);
        }
    }
}

// ============================================
// FREE MAC MANAGER (unchanged)
// ============================================
class FreeMACManager {
    constructor() {
        this.macs = [];
        this.nextMacId = 1;
        this.macPermissions = JSON.parse(JSON.stringify(CONFIG.MAC_PERMISSIONS));
        this.loadFromStorage();
        this.startExpiryCheck();
    }

    addMAC(url, macAddress, expiryDate) {
        const urlValidation = securityManager.validateURL(url);
        const macValidation = securityManager.validateInput(macAddress, 'string');

        if (!urlValidation.valid || !macValidation.valid) {
            return { success: false, message: "Invalid characters in input" };
        }

        const sanitizedUrl = urlValidation.sanitized.trim();
        const sanitizedMac = macValidation.sanitized.trim().toUpperCase();

        if (!this.isValidMAC(sanitizedMac)) {
            return { success: false, message: "Invalid MAC address format" };
        }

        if (!this.isValidURL(sanitizedUrl)) {
            return { success: false, message: "Invalid URL format" };
        }

        if (this.macs.some(mac => mac.macAddress === sanitizedMac)) {
            return { success: false, message: "MAC address already exists" };
        }

        if (expiryDate) {
            const expiry = new Date(expiryDate);
            const now = new Date();
            const expiryDateOnly = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            if (expiryDateOnly.getTime() < today.getTime()) {
                console.log(`[MACManager] Rejected expired MAC: ${sanitizedMac} (expiry: ${expiryDate})`);
                return { success: false, message: "Cannot add MAC with expired date" };
            }
        }

        const newMAC = {
            id: this.nextMacId++,
            url: sanitizedUrl,
            macAddress: sanitizedMac,
            expiryDate: expiryDate,
            created: new Date().toISOString(),
            createdBy: userManager.currentUser ? userManager.currentUser.email : 'system'
        };

        this.macs.push(newMAC);
        
        this.saveToStorage().then(() => {
            console.log('[MACManager] MAC added and synced:', newMAC.id);
        });

        securityManager.logSecurityEvent('MAC_ADDED', { 
            macId: newMAC.id,
            addedBy: userManager.currentUser ? userManager.currentUser.email : 'system'
        });

        return { success: true, mac: newMAC };
    }

    editMAC(id, data) {
        const macIndex = this.macs.findIndex(mac => mac.id === id);

        if (macIndex === -1) {
            return { success: false, message: "MAC not found" };
        }

        if (data.macAddress) {
            const validation = securityManager.validateInput(data.macAddress, 'string');
            if (!validation.valid) return { success: false, message: "Invalid MAC address" };
            const sanitizedMac = validation.sanitized.trim().toUpperCase();

            if (!this.isValidMAC(sanitizedMac)) {
                return { success: false, message: "Invalid MAC address format" };
            }

            if (this.macs.some((mac, index) => mac.macAddress === sanitizedMac && index !== macIndex)) {
                return { success: false, message: "MAC address already exists" };
            }

            this.macs[macIndex].macAddress = sanitizedMac;
        }

        if (data.url) {
            const validation = securityManager.validateURL(data.url);
            if (!validation.valid) return { success: false, message: "Invalid URL" };
            const sanitizedUrl = validation.sanitized.trim();

            if (!this.isValidURL(sanitizedUrl)) {
                return { success: false, message: "Invalid URL format" };
            }
            this.macs[macIndex].url = sanitizedUrl;
        }

        if (data.expiryDate) {
            this.macs[macIndex].expiryDate = data.expiryDate;
        }

        this.saveToStorage().then(() => {
            console.log('[MACManager] MAC edited and synced:', id);
        });

        securityManager.logSecurityEvent('MAC_EDITED', { 
            macId: id,
            editedBy: userManager.currentUser ? userManager.currentUser.email : 'system'
        });

        return { success: true, mac: this.macs[macIndex] };
    }

    async deleteMAC(id) {
        const macIndex = this.macs.findIndex(mac => mac.id === id);

        if (macIndex === -1) {
            return { success: false, message: "MAC not found" };
        }

        if (typeof firebaseManager !== 'undefined' && firebaseManager.isInitialized) {
            try {
                const fbResult = await firebaseManager.deleteMAC(id);
                if (!fbResult.success && !fbResult.offline) {
                    console.error('[MACManager] Firebase delete failed:', fbResult.error);
                    return { success: false, message: "Failed to delete from database: " + fbResult.error };
                }
                console.log('[MACManager] ✅ MAC deleted from Firebase:', id);
            } catch (error) {
                console.error('[MACManager] Firebase delete error:', error);
                return { success: false, message: "Database error: " + error.message };
            }
        }

        this.macs.splice(macIndex, 1);
        
        try {
            securityManager.secureStore(CONFIG.STORAGE_KEYS.FREE_MACS, this.macs);
            localStorage.setItem(CONFIG.STORAGE_KEYS.NEXT_MAC_ID, this.nextMacId.toString());
        } catch (e) {
            console.error("Error saving MACs to storage:", e);
        }

        securityManager.logSecurityEvent('MAC_DELETED', { 
            macId: id,
            deletedBy: userManager.currentUser ? userManager.currentUser.email : 'system'
        });

        return { success: true };
    }

    getAllMACs() {
        const currentUser = userManager.currentUser;

        if (!currentUser) {
            return { success: false, message: "You must be logged in to view MACs" };
        }

        const permissions = this.macPermissions[currentUser.role];

        if (!permissions || !permissions.canView) {
            return { success: false, message: "You don't have permission to view MACs" };
        }

        const sortedMACs = [...this.macs].sort((a, b) => {
            const dateA = new Date(a.expiryDate);
            const dateB = new Date(b.expiryDate);
            return dateA - dateB;
        });

        const macsWithStatus = sortedMACs.map(mac => {
            const isExpired = this.isMACExpired(mac);
            return {
                ...mac,
                status: isExpired ? 'expired' : 'active',
                daysLeft: isExpired ? 0 : this.getDaysLeft(mac.expiryDate)
            };
        });

        return { success: true, macs: macsWithStatus };
    }

    getMACById(id) {
        return this.macs.find(mac => mac.id === id);
    }

    canUserAddMAC() {
        const currentUser = userManager.currentUser;
        if (!currentUser) return false;
        const permissions = this.macPermissions[currentUser.role];
        return permissions ? permissions.canAdd : false;
    }

    canUserEditMAC() {
        const currentUser = userManager.currentUser;
        if (!currentUser) return false;
        const permissions = this.macPermissions[currentUser.role];
        return permissions ? permissions.canEdit : false;
    }

    canUserDeleteMAC() {
        const currentUser = userManager.currentUser;
        if (!currentUser) return false;
        const permissions = this.macPermissions[currentUser.role];
        return permissions ? permissions.canDelete : false;
    }

    isMACExpired(mac) {
        if (!mac.expiryDate) {
            console.log(`[MACManager] MAC ${mac.id} has no expiry date`);
            return false;
        }

        const expiry = new Date(mac.expiryDate);
        const now = new Date();

        const expiryDate = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const isExpired = expiryDate.getTime() < today.getTime();

        if (isExpired) {
            console.log(`[MACManager] MAC ${mac.id} (${mac.macAddress}) is EXPIRED: ${mac.expiryDate}`);
        }

        return isExpired;
    }

    isMACExpiringSoon(mac, days = 1) {
        if (!mac.expiryDate) return false;
        const expiryDate = new Date(mac.expiryDate);
        const now = new Date();
        const diffTime = expiryDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= days && diffDays > 0;
    }

    getDaysLeft(expiryDate) {
        const expiry = new Date(expiryDate);
        const now = new Date();
        const diffTime = expiry - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    }

    async removeExpiredMACs() {
        const expiredMACs = this.macs.filter(mac => this.isMACExpired(mac));
        const expiredCount = expiredMACs.length;

        if (expiredCount === 0) {
            console.log('[MACManager] No expired MACs found');
            return 0;
        }

        console.log(`[MACManager] Found ${expiredCount} expired MACs to remove:`, 
            expiredMACs.map(m => ({ id: m.id, mac: m.macAddress, expiry: m.expiryDate })));

        if (typeof firebaseManager !== 'undefined' && firebaseManager.isInitialized) {
            for (const mac of expiredMACs) {
                try {
                    await firebaseManager.deleteMAC(mac.id);
                    console.log(`[MACManager] ✅ Deleted expired MAC ${mac.id} from Firebase`);
                } catch (error) {
                    console.error(`[MACManager] ❌ Failed to delete expired MAC ${mac.id}:`, error);
                }
            }
        } else {
            console.warn('[MACManager] Firebase not available, skipping Firebase deletion');
        }

        this.macs = this.macs.filter(mac => !this.isMACExpired(mac));

        try {
            securityManager.secureStore(CONFIG.STORAGE_KEYS.FREE_MACS, this.macs);
            localStorage.setItem(CONFIG.STORAGE_KEYS.NEXT_MAC_ID, this.nextMacId.toString());
            console.log(`[MACManager] ✅ Saved ${this.macs.length} MACs to localStorage`);
        } catch (e) {
            console.error("[MACManager] Error saving to storage:", e);
        }

        securityManager.logSecurityEvent('EXPIRED_MACS_REMOVED', { count: expiredCount });

        if (typeof firebaseManager !== 'undefined') {
            firebaseManager.broadcastChange('macs');
        }

        return expiredCount;
    }

    startExpiryCheck() {
        setTimeout(async () => {
            console.log('[MACManager] Running initial expiry check...');
            const removed = await this.removeExpiredMACs();
            if (removed > 0) {
                console.log(`[MACManager] ✅ Initial cleanup: removed ${removed} expired MACs`);
                if (document.getElementById('free-mac-section')?.style.display !== 'none') {
                    updateFreeMACCards();
                    notificationSystem.info(
                        'Expired MACs Removed',
                        `${removed} expired MAC(s) have been automatically removed`,
                        3
                    );
                }
            } else {
                console.log('[MACManager] No expired MACs found in initial check');
            }
        }, 3000);

        const interval = CONFIG.SYSTEM.CHECK_EXPIRY_INTERVAL || 300000;
        console.log(`[MACManager] Setting up periodic expiry check every ${interval/1000} seconds`);

        setInterval(async () => {
            console.log('[MACManager] Running periodic expiry check...');
            const removed = await this.removeExpiredMACs();
            if (removed > 0) {
                console.log(`[MACManager] ✅ Periodic cleanup: removed ${removed} expired MACs`);
                if (document.getElementById('free-mac-section')?.style.display !== 'none') {
                    updateFreeMACCards();
                    notificationSystem.info(
                        'Expired MACs Removed',
                        `${removed} expired MAC(s) have been automatically removed`,
                        3
                    );
                }
            }
        }, interval);
    }

    isValidMAC(mac) {
        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        return macRegex.test(mac);
    }

    isValidURL(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    copyToClipboard(text) {
        return navigator.clipboard.writeText(text).then(() => {
            return true;
        }).catch(err => {
            console.error('Failed to copy: ', err);
            return false;
        });
    }

    async saveToStorage() {
        try {
            securityManager.secureStore(CONFIG.STORAGE_KEYS.FREE_MACS, this.macs);
            localStorage.setItem(CONFIG.STORAGE_KEYS.NEXT_MAC_ID, this.nextMacId.toString());

            if (typeof firebaseManager !== 'undefined') {
                await firebaseManager.ensureInitialized();
                
                if (firebaseManager.isInitialized) {
                    console.log('[MACManager] Syncing to Firebase...');
                    
                    const syncPromises = this.macs.map(mac => 
                        firebaseManager.syncMAC(mac).catch(err => {
                            console.error('[MACManager] Sync error for MAC', mac.id, err);
                        })
                    );
                    
                    await Promise.all(syncPromises);
                    console.log('[MACManager] ✅ Firebase sync complete');
                } else {
                    console.warn('[MACManager] Firebase not initialized, data queued');
                }
            }
        } catch (e) {
            console.error("Error saving MACs to storage:", e);
        }
    }

    loadFromStorage() {
        try {
            const savedMACs = securityManager.secureRetrieve(CONFIG.STORAGE_KEYS.FREE_MACS);
            const savedNextMacId = localStorage.getItem(CONFIG.STORAGE_KEYS.NEXT_MAC_ID);

            if (savedMACs) {
                this.macs = savedMACs;
            }

            if (savedNextMacId) {
                this.nextMacId = parseInt(savedNextMacId);
            }
        } catch (e) {
            console.error("Error loading MACs from storage:", e);
        }
    }
}

// ============================================
// FREE XTREAM MANAGER (unchanged)
// ============================================
class FreeXtreamManager {
    constructor() {
        this.xtreams = [];
        this.nextXtreamId = 1;
        this.xtreamPermissions = JSON.parse(JSON.stringify(CONFIG.XTREAM_PERMISSIONS));
        this.loadFromStorage();
        this.startExpiryCheck();
    }

    addXtream(url, username, password, expiryDate) {
        const urlValidation = securityManager.validateURL(url);
        const usernameValidation = securityManager.validateInput(username, 'string');

        if (!urlValidation.valid || !usernameValidation.valid) {
            return { success: false, message: "Invalid characters in input" };
        }

        const sanitizedUrl = urlValidation.sanitized.trim();
        const sanitizedUsername = usernameValidation.sanitized.trim();

        if (!this.isValidURL(sanitizedUrl)) {
            return { success: false, message: "Invalid URL format" };
        }

        if (!sanitizedUsername || !password) {
            return { success: false, message: "Username and password are required" };
        }

        if (this.xtreams.some(xtream => xtream.url === sanitizedUrl && xtream.username === sanitizedUsername)) {
            return { success: false, message: "Xtream with same URL and username already exists" };
        }

        if (expiryDate) {
            const expiry = new Date(expiryDate);
            const now = new Date();
            const expiryDateOnly = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            if (expiryDateOnly.getTime() < today.getTime()) {
                console.log(`[XtreamManager] Rejected expired Xtream: ${sanitizedUsername} (expiry: ${expiryDate})`);
                return { success: false, message: "Cannot add Xtream with expired date" };
            }
        }

        const newXtream = {
            id: this.nextXtreamId++,
            url: sanitizedUrl,
            username: sanitizedUsername,
            password: password,
            expiryDate: expiryDate,
            created: new Date().toISOString(),
            createdBy: userManager.currentUser ? userManager.currentUser.email : 'system'
        };

        this.xtreams.push(newXtream);
        
        this.saveToStorage().then(() => {
            console.log('[XtreamManager] Xtream added and synced:', newXtream.id);
        });

        securityManager.logSecurityEvent('XTREAM_ADDED', { 
            xtreamId: newXtream.id,
            addedBy: userManager.currentUser ? userManager.currentUser.email : 'system'
        });

        return { success: true, xtream: newXtream };
    }

    editXtream(id, data) {
        const xtreamIndex = this.xtreams.findIndex(xtream => xtream.id === id);

        if (xtreamIndex === -1) {
            return { success: false, message: "Xtream not found" };
        }

        if (data.url) {
            const validation = securityManager.validateURL(data.url);
            if (!validation.valid) return { success: false, message: "Invalid URL" };
            const sanitizedUrl = validation.sanitized.trim();

            if (!this.isValidURL(sanitizedUrl)) {
                return { success: false, message: "Invalid URL format" };
            }
            this.xtreams[xtreamIndex].url = sanitizedUrl;
        }

        if (data.username) {
            const validation = securityManager.validateInput(data.username, 'string');
            if (!validation.valid) return { success: false, message: "Invalid username" };
            this.xtreams[xtreamIndex].username = validation.sanitized.trim();
        }

        if (data.password) {
            this.xtreams[xtreamIndex].password = data.password;
        }

        if (data.expiryDate) {
            this.xtreams[xtreamIndex].expiryDate = data.expiryDate;
        }

        this.saveToStorage().then(() => {
            console.log('[XtreamManager] Xtream edited and synced:', id);
        });

        securityManager.logSecurityEvent('XTREAM_EDITED', { 
            xtreamId: id,
            editedBy: userManager.currentUser ? userManager.currentUser.email : 'system'
        });

        return { success: true, xtream: this.xtreams[xtreamIndex] };
    }

    async deleteXtream(id) {
        const xtreamIndex = this.xtreams.findIndex(xtream => xtream.id === id);

        if (xtreamIndex === -1) {
            return { success: false, message: "Xtream not found" };
        }

        if (typeof firebaseManager !== 'undefined' && firebaseManager.isInitialized) {
            try {
                const fbResult = await firebaseManager.deleteXtream(id);
                if (!fbResult.success && !fbResult.offline) {
                    console.error('[XtreamManager] Firebase delete failed:', fbResult.error);
                    return { success: false, message: "Failed to delete from database: " + fbResult.error };
                }
                console.log('[XtreamManager] ✅ Xtream deleted from Firebase:', id);
            } catch (error) {
                console.error('[XtreamManager] Firebase delete error:', error);
                return { success: false, message: "Database error: " + error.message };
            }
        }

        this.xtreams.splice(xtreamIndex, 1);
        
        try {
            securityManager.secureStore(CONFIG.STORAGE_KEYS.FREE_XTREAMS, this.xtreams);
            localStorage.setItem(CONFIG.STORAGE_KEYS.NEXT_XTREAM_ID, this.nextXtreamId.toString());
        } catch (e) {
            console.error("Error saving Xtreams to storage:", e);
        }

        securityManager.logSecurityEvent('XTREAM_DELETED', { 
            xtreamId: id,
            deletedBy: userManager.currentUser ? userManager.currentUser.email : 'system'
        });

        return { success: true };
    }

    getAllXtreams() {
        const currentUser = userManager.currentUser;

        if (!currentUser) {
            return { success: false, message: "You must be logged in to view Xtreams" };
        }

        const permissions = this.xtreamPermissions[currentUser.role];

        if (!permissions || !permissions.canView) {
            return { success: false, message: "You don't have permission to view Xtreams" };
        }

        const sortedXtreams = [...this.xtreams].sort((a, b) => {
            const dateA = new Date(a.expiryDate);
            const dateB = new Date(b.expiryDate);
            return dateA - dateB;
        });

        const xtreamsWithStatus = sortedXtreams.map(xtream => {
            const isExpired = this.isXtreamExpired(xtream);
            return {
                ...xtream,
                status: isExpired ? 'expired' : 'active',
                daysLeft: isExpired ? 0 : this.getDaysLeft(xtream.expiryDate)
            };
        });

        return { success: true, xtreams: xtreamsWithStatus };
    }

    getXtreamById(id) {
        return this.xtreams.find(xtream => xtream.id === id);
    }

    canUserAddXtream() {
        const currentUser = userManager.currentUser;
        if (!currentUser) return false;
        const permissions = this.xtreamPermissions[currentUser.role];
        return permissions ? permissions.canAdd : false;
    }

    canUserEditXtream() {
        const currentUser = userManager.currentUser;
        if (!currentUser) return false;
        const permissions = this.xtreamPermissions[currentUser.role];
        return permissions ? permissions.canEdit : false;
    }

    canUserDeleteXtream() {
        const currentUser = userManager.currentUser;
        if (!currentUser) return false;
        const permissions = this.xtreamPermissions[currentUser.role];
        return permissions ? permissions.canDelete : false;
    }

    isXtreamExpired(xtream) {
        if (!xtream.expiryDate) {
            console.log(`[XtreamManager] Xtream ${xtream.id} has no expiry date`);
            return false;
        }

        const expiry = new Date(xtream.expiryDate);
        const now = new Date();

        const expiryDate = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const isExpired = expiryDate.getTime() < today.getTime();

        if (isExpired) {
            console.log(`[XtreamManager] Xtream ${xtream.id} (${xtream.username}) is EXPIRED: ${xtream.expiryDate}`);
        }

        return isExpired;
    }

    isXtreamExpiringSoon(xtream, days = 1) {
        if (!xtream.expiryDate) return false;
        const expiryDate = new Date(xtream.expiryDate);
        const now = new Date();
        const diffTime = expiryDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= days && diffDays > 0;
    }

    getDaysLeft(expiryDate) {
        const expiry = new Date(expiryDate);
        const now = new Date();
        const diffTime = expiry - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    }

    async removeExpiredXtreams() {
        const expiredXtreams = this.xtreams.filter(xtream => this.isXtreamExpired(xtream));
        const expiredCount = expiredXtreams.length;

        if (expiredCount === 0) {
            console.log('[XtreamManager] No expired Xtreams found');
            return 0;
        }

        console.log(`[XtreamManager] Found ${expiredCount} expired Xtreams to remove:`, 
            expiredXtreams.map(x => ({ id: x.id, username: x.username, expiry: x.expiryDate })));

        if (typeof firebaseManager !== 'undefined' && firebaseManager.isInitialized) {
            for (const xtream of expiredXtreams) {
                try {
                    await firebaseManager.deleteXtream(xtream.id);
                    console.log(`[XtreamManager] ✅ Deleted expired Xtream ${xtream.id} from Firebase`);
                } catch (error) {
                    console.error(`[XtreamManager] ❌ Failed to delete expired Xtream ${xtream.id}:`, error);
                }
            }
        } else {
            console.warn('[XtreamManager] Firebase not available, skipping Firebase deletion');
        }

        this.xtreams = this.xtreams.filter(xtream => !this.isXtreamExpired(xtream));

        try {
            securityManager.secureStore(CONFIG.STORAGE_KEYS.FREE_XTREAMS, this.xtreams);
            localStorage.setItem(CONFIG.STORAGE_KEYS.NEXT_XTREAM_ID, this.nextXtreamId.toString());
            console.log(`[XtreamManager] ✅ Saved ${this.xtreams.length} Xtreams to localStorage`);
        } catch (e) {
            console.error("[XtreamManager] Error saving to storage:", e);
        }

        securityManager.logSecurityEvent('EXPIRED_XTREAMS_REMOVED', { count: expiredCount });

        if (typeof firebaseManager !== 'undefined') {
            firebaseManager.broadcastChange('xtreams');
        }

        return expiredCount;
    }

    startExpiryCheck() {
        setTimeout(async () => {
            console.log('[XtreamManager] Running initial expiry check...');
            const removed = await this.removeExpiredXtreams();
            if (removed > 0) {
                console.log(`[XtreamManager] ✅ Initial cleanup: removed ${removed} expired Xtreams`);
                if (document.getElementById('free-xtream-section')?.style.display !== 'none') {
                    updateFreeXtreamCards();
                    notificationSystem.info(
                        'Expired Xtreams Removed',
                        `${removed} expired Xtream(s) have been automatically removed`,
                        3
                    );
                }
            } else {
                console.log('[XtreamManager] No expired Xtreams found in initial check');
            }
        }, 3000);

        const interval = CONFIG.SYSTEM.CHECK_EXPIRY_INTERVAL || 300000;
        console.log(`[XtreamManager] Setting up periodic expiry check every ${interval/1000} seconds`);

        setInterval(async () => {
            console.log('[XtreamManager] Running periodic expiry check...');
            const removed = await this.removeExpiredXtreams();
            if (removed > 0) {
                console.log(`[XtreamManager] ✅ Periodic cleanup: removed ${removed} expired Xtreams`);
                if (document.getElementById('free-xtream-section')?.style.display !== 'none') {
                    updateFreeXtreamCards();
                    notificationSystem.info(
                        'Expired Xtreams Removed',
                        `${removed} expired Xtream(s) have been automatically removed`,
                        3
                    );
                }
            }
        }, interval);
    }

    isValidURL(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    copyToClipboard(text) {
        return navigator.clipboard.writeText(text).then(() => {
            return true;
        }).catch(err => {
            console.error('Failed to copy: ', err);
            return false;
        });
    }

    async saveToStorage() {
        try {
            securityManager.secureStore(CONFIG.STORAGE_KEYS.FREE_XTREAMS, this.xtreams);
            localStorage.setItem(CONFIG.STORAGE_KEYS.NEXT_XTREAM_ID, this.nextXtreamId.toString());

            if (typeof firebaseManager !== 'undefined') {
                await firebaseManager.ensureInitialized();
                
                if (firebaseManager.isInitialized) {
                    console.log('[XtreamManager] Syncing to Firebase...');
                    
                    const syncPromises = this.xtreams.map(xtream => 
                        firebaseManager.syncXtream(xtream).catch(err => {
                            console.error('[XtreamManager] Sync error for xtream', xtream.id, err);
                        })
                    );
                    
                    await Promise.all(syncPromises);
                    console.log('[XtreamManager] ✅ Firebase sync complete');
                } else {
                    console.warn('[XtreamManager] Firebase not initialized, data queued');
                }
            }
        } catch (e) {
            console.error("[XtreamManager] Error saving Xtreams to storage:", e);
        }
    }

    loadFromStorage() {
        try {
            const savedXtreams = securityManager.secureRetrieve(CONFIG.STORAGE_KEYS.FREE_XTREAMS);
            const savedNextXtreamId = localStorage.getItem(CONFIG.STORAGE_KEYS.NEXT_XTREAM_ID);

            if (savedXtreams) {
                this.xtreams = savedXtreams;
            }

            if (savedNextXtreamId) {
                this.nextXtreamId = parseInt(savedNextXtreamId);
            }
        } catch (e) {
            console.error("[XtreamManager] Error loading Xtreams from storage:", e);
        }
    }
}

// ============================================
// TICKET MANAGER (unchanged)
// ============================================
class TicketManager {
    constructor() {
        this.tickets = [];
        this.nextTicketId = 1;
        this.currentUser = null;
        this.loadFromStorage();
        this.loadCurrentUser();
    }

    loadCurrentUser() {
        try {
            const savedCurrentUser = securityManager.secureRetrieve(CONFIG.STORAGE_KEYS.CURRENT_USER);
            if (savedCurrentUser) {
                this.currentUser = savedCurrentUser;
            }
        } catch (e) {
            console.error("Error loading current user:", e);
        }
    }

    createTicket(subject, category, priority, description) {
        if (!this.currentUser) {
            return { success: false, message: "You must be logged in to create a ticket" };
        }

        const trimmedSubject = subject.trim();
        const trimmedDescription = description.trim();

        if (!trimmedSubject || !trimmedDescription) {
            return { success: false, message: "Subject and description are required" };
        }

        const newTicket = {
            id: this.nextTicketId++,
            subject: trimmedSubject,
            category: securityManager.sanitizeInput(category),
            priority: securityManager.sanitizeInput(priority),
            description: trimmedDescription,
            status: 'open',
            createdBy: {
                id: this.currentUser.id,
                email: this.currentUser.email,
                name: this.currentUser.name,
                role: this.currentUser.role
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: [
                {
                    id: 1,
                    sender: {
                        id: this.currentUser.id,
                        email: this.currentUser.email,
                        name: this.currentUser.name,
                        role: this.currentUser.role
                    },
                    content: trimmedDescription,
                    createdAt: new Date().toISOString(),
                    isInitial: true
                }
            ]
        };

        this.tickets.push(newTicket);
        
        this.saveToStorage().then(() => {
            console.log('[TicketManager] Ticket created and synced:', newTicket.id);
        });

        securityManager.logSecurityEvent('TICKET_CREATED', { 
            ticketId: newTicket.id,
            createdBy: this.currentUser.email
        });

        return { success: true, ticket: newTicket };
    }

    getTicketsForUser() {
        if (!this.currentUser) {
            return { success: false, message: "You must be logged in to view tickets" };
        }

        if (this.currentUser.role === 'admin' || this.currentUser.role === 'owner') {
            return { success: true, tickets: this.tickets };
        }

        const userTickets = this.tickets.filter(ticket => 
            ticket.createdBy.id === this.currentUser.id
        );

        return { success: true, tickets: userTickets };
    }

    getTicketById(id) {
        const ticket = this.tickets.find(t => t.id === id);

        if (!ticket) {
            return { success: false, message: "Ticket not found" };
        }

        if (this.currentUser.role !== 'admin' && 
            this.currentUser.role !== 'owner' && 
            ticket.createdBy.id !== this.currentUser.id) {
            securityManager.logSecurityEvent('UNAUTHORIZED_TICKET_ACCESS', { 
                ticketId: id,
                attemptedBy: this.currentUser.email
            });
            return { success: false, message: "You don't have permission to view this ticket" };
        }

        return { success: true, ticket: ticket };
    }

    addMessageToTicket(ticketId, content) {
        if (!this.currentUser) {
            return { success: false, message: "You must be logged in to reply to tickets" };
        }

        const trimmedContent = content.trim();

        const ticketIndex = this.tickets.findIndex(t => t.id === ticketId);

        if (ticketIndex === -1) {
            return { success: false, message: "Ticket not found" };
        }

        if (this.currentUser.role !== 'admin' && 
            this.currentUser.role !== 'owner' && 
            this.tickets[ticketIndex].createdBy.id !== this.currentUser.id) {
            securityManager.logSecurityEvent('UNAUTHORIZED_TICKET_REPLY', { 
                ticketId: ticketId,
                attemptedBy: this.currentUser.email
            });
            return { success: false, message: "You don't have permission to reply to this ticket" };
        }

        if (this.tickets[ticketIndex].status === 'closed') {
            return { success: false, message: "Cannot reply to a closed ticket" };
        }

        const messageId = this.tickets[ticketIndex].messages.length + 1;

        const newMessage = {
            id: messageId,
            sender: {
                id: this.currentUser.id,
                email: this.currentUser.email,
                name: this.currentUser.name,
                role: this.currentUser.role
            },
            content: trimmedContent,
            createdAt: new Date().toISOString(),
            isInitial: false
        };

        this.tickets[ticketIndex].messages.push(newMessage);
        this.tickets[ticketIndex].updatedAt = new Date().toISOString();

        if ((this.currentUser.role === 'admin' || this.currentUser.role === 'owner') && 
            this.tickets[ticketIndex].status === 'open') {
            this.tickets[ticketIndex].status = 'pending';
        }

        this.saveToStorage().then(() => {
            console.log('[TicketManager] Reply added and synced:', ticketId);
        });

        securityManager.logSecurityEvent('TICKET_REPLY_ADDED', { 
            ticketId: ticketId,
            messageId: messageId,
            addedBy: this.currentUser.email
        });

        return { success: true, ticket: this.tickets[ticketIndex] };
    }

    updateTicketStatus(ticketId, status) {
        const ticketIndex = this.tickets.findIndex(t => t.id === ticketId);

        if (ticketIndex === -1) {
            return { success: false, message: "Ticket not found" };
        }

        if (this.currentUser.role !== 'admin' && this.currentUser.role !== 'owner') {
            securityManager.logSecurityEvent('UNAUTHORIZED_STATUS_CHANGE', { 
                ticketId: ticketId,
                attemptedBy: this.currentUser.email
            });
            return { success: false, message: "You don't have permission to update ticket status" };
        }

        this.tickets[ticketIndex].status = securityManager.sanitizeInput(status);
        this.tickets[ticketIndex].updatedAt = new Date().toISOString();

        this.saveToStorage().then(() => {
            console.log('[TicketManager] Status updated and synced:', ticketId);
        });

        securityManager.logSecurityEvent('TICKET_STATUS_CHANGED', { 
            ticketId: ticketId,
            newStatus: status,
            changedBy: this.currentUser.email
        });

        return { success: true, ticket: this.tickets[ticketIndex] };
    }

    updateTicket(ticketId, subject, category, priority, description) {
        const ticketIndex = this.tickets.findIndex(t => t.id === ticketId);

        if (ticketIndex === -1) {
            return { success: false, message: "Ticket not found" };
        }

        const trimmedSubject = subject.trim();
        const trimmedDescription = description.trim();

        if (this.currentUser.role !== 'admin' && 
            this.currentUser.role !== 'owner' && 
            this.tickets[ticketIndex].createdBy.id !== this.currentUser.id) {
            securityManager.logSecurityEvent('UNAUTHORIZED_TICKET_EDIT', { 
                ticketId: ticketId,
                attemptedBy: this.currentUser.email
            });
            return { success: false, message: "You don't have permission to update this ticket" };
        }

        if (this.tickets[ticketIndex].status === 'closed') {
            return { success: false, message: "Cannot update a closed ticket" };
        }

        this.tickets[ticketIndex].subject = trimmedSubject;
        this.tickets[ticketIndex].category = securityManager.sanitizeInput(category);
        this.tickets[ticketIndex].priority = securityManager.sanitizeInput(priority);
        this.tickets[ticketIndex].description = trimmedDescription;
        this.tickets[ticketIndex].updatedAt = new Date().toISOString();

        if (this.tickets[ticketIndex].messages.length > 0 && this.tickets[ticketIndex].messages[0].isInitial) {
            this.tickets[ticketIndex].messages[0].content = trimmedDescription;
        }

        this.saveToStorage().then(() => {
            console.log('[TicketManager] Ticket updated and synced:', ticketId);
        });

        securityManager.logSecurityEvent('TICKET_UPDATED', { 
            ticketId: ticketId,
            updatedBy: this.currentUser.email
        });

        return { success: true, ticket: this.tickets[ticketIndex] };
    }

    async deleteTicket(ticketId) {
        const ticketIndex = this.tickets.findIndex(t => t.id === ticketId);

        if (ticketIndex === -1) {
            return { success: false, message: "Ticket not found" };
        }

        if (this.currentUser.role !== 'admin' && 
            this.currentUser.role !== 'owner' && 
            this.tickets[ticketIndex].createdBy.id !== this.currentUser.id) {
            securityManager.logSecurityEvent('UNAUTHORIZED_TICKET_DELETE', { 
                ticketId: ticketId,
                attemptedBy: this.currentUser.email
            });
            return { success: false, message: "You don't have permission to delete this ticket" };
        }

        if (typeof firebaseManager !== 'undefined' && firebaseManager.isInitialized) {
            try {
                const fbResult = await firebaseManager.deleteTicket(ticketId);
                if (!fbResult.success && !fbResult.offline) {
                    console.error('[TicketManager] Firebase delete failed:', fbResult.error);
                    return { success: false, message: "Failed to delete from database: " + fbResult.error };
                }
                console.log('[TicketManager] ✅ Ticket deleted from Firebase:', ticketId);
            } catch (error) {
                console.error('[TicketManager] Firebase delete error:', error);
                return { success: false, message: "Database error: " + error.message };
            }
        }

        this.tickets.splice(ticketIndex, 1);
        
        try {
            securityManager.secureStore(CONFIG.STORAGE_KEYS.TICKETS, this.tickets);
            localStorage.setItem(CONFIG.STORAGE_KEYS.NEXT_TICKET_ID, this.nextTicketId.toString());
        } catch (e) {
            console.error("Error saving tickets to storage:", e);
        }

        securityManager.logSecurityEvent('TICKET_DELETED', { 
            ticketId: ticketId,
            deletedBy: this.currentUser.email
        });

        return { success: true, message: "Ticket deleted successfully" };
    }

    async saveToStorage() {
        try {
            securityManager.secureStore(CONFIG.STORAGE_KEYS.TICKETS, this.tickets);
            localStorage.setItem(CONFIG.STORAGE_KEYS.NEXT_TICKET_ID, this.nextTicketId.toString());

            if (typeof firebaseManager !== 'undefined') {
                await firebaseManager.ensureInitialized();
                
                if (firebaseManager.isInitialized) {
                    console.log('[TicketManager] Syncing to Firebase...');
                    
                    const syncPromises = this.tickets.map(ticket => 
                        firebaseManager.syncTicket(ticket).catch(err => {
                            console.error('[TicketManager] Sync error for ticket', ticket.id, err);
                        })
                    );
                    
                    await Promise.all(syncPromises);
                    console.log('[TicketManager] ✅ Firebase sync complete');
                } else {
                    console.warn('[TicketManager] Firebase not initialized, data queued');
                }
            }
        } catch (e) {
            console.error("Error saving tickets to storage:", e);
        }
    }

    loadFromStorage() {
        try {
            const savedTickets = securityManager.secureRetrieve(CONFIG.STORAGE_KEYS.TICKETS);
            const savedNextTicketId = localStorage.getItem(CONFIG.STORAGE_KEYS.NEXT_TICKET_ID);

            if (savedTickets) {
                this.tickets = savedTickets;
            }

            if (savedNextTicketId) {
                this.nextTicketId = parseInt(savedNextTicketId);
            }
        } catch (e) {
            console.error("Error loading tickets from storage:", e);
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    getStatusBadgeClass(status) {
        switch(status) {
            case 'open': return 'status-open';
            case 'pending': return 'status-pending';
            case 'closed': return 'status-closed';
            default: return 'status-open';
        }
    }

    getPriorityBadgeClass(priority) {
        switch(priority) {
            case 'low': return 'priority-low';
            case 'medium': return 'priority-medium';
            case 'high': return 'priority-high';
            default: return 'priority-medium';
        }
    }

    getCategoryDisplay(category) {
        switch(category) {
            case 'technical': return 'Technical';
            case 'billing': return 'Billing';
            case 'account': return 'Account';
            case 'feature': return 'Feature Request';
            case 'other': return 'Other';
            default: return category;
        }
    }

    getRoleBadgeClass(role) {
        switch(role) {
            case 'user': return 'role-user';
            case 'admin': return 'role-admin';
            case 'owner': return 'role-owner';
            default: return 'role-user';
        }
    }

    canEditTicket(ticket) {
        if (!this.currentUser) return false;
        if (this.currentUser.role === 'admin' || this.currentUser.role === 'owner') return true;
        if (ticket.createdBy.id === this.currentUser.id && ticket.status !== 'closed') return true;
        return false;
    }

    canDeleteTicket(ticket) {
        if (!this.currentUser) return false;
        if (this.currentUser.role === 'admin' || this.currentUser.role === 'owner') return true;
        if (ticket.createdBy.id === this.currentUser.id) return true;
        return false;
    }
}

// ============================================
// IPTV APPS MANAGER (unchanged)
// ============================================
class IPTVAppsManager {
    constructor() {
        this.apps = [];
        this.nextAppId = 1;
        this.appsPermissions = JSON.parse(JSON.stringify(CONFIG.IPTV_APPS_PERMISSIONS));
        this.loadFromStorage();
    }

    addApp(name, downloadUrl) {
        const nameValidation = securityManager.validateInput(name, 'string');
        const urlValidation = securityManager.validateURL(downloadUrl);

        if (!nameValidation.valid || !urlValidation.valid) {
            return { success: false, message: "Invalid characters in input" };
        }

        const sanitizedName = nameValidation.sanitized.trim();
        const sanitizedUrl = urlValidation.sanitized.trim();

        if (!sanitizedName) {
            return { success: false, message: "App name is required" };
        }

        if (!sanitizedUrl) {
            return { success: false, message: "Download URL is required" };
        }

        if (!this.isValidURL(sanitizedUrl)) {
            return { success: false, message: "Invalid URL format" };
        }

        if (this.apps.some(app => app.name.toLowerCase() === sanitizedName.toLowerCase())) {
            return { success: false, message: "App with this name already exists" };
        }

        const newApp = {
            id: this.nextAppId++,
            name: sanitizedName,
            downloadUrl: sanitizedUrl,
            created: new Date().toISOString(),
            createdBy: userManager.currentUser ? userManager.currentUser.email : 'system'
        };

        this.apps.push(newApp);
        
        this.saveToStorage().then(() => {
            console.log('[AppsManager] App added and synced:', newApp.id);
        });

        securityManager.logSecurityEvent('APP_ADDED', { 
            appId: newApp.id,
            appName: sanitizedName,
            addedBy: userManager.currentUser ? userManager.currentUser.email : 'system'
        });

        return { success: true, app: newApp };
    }

    editApp(id, data) {
        const appIndex = this.apps.findIndex(app => app.id === id);

        if (appIndex === -1) {
            return { success: false, message: "App not found" };
        }

        if (data.name) {
            const validation = securityManager.validateInput(data.name, 'string');
            if (!validation.valid) return { success: false, message: "Invalid app name" };
            const sanitizedName = validation.sanitized.trim();

            const existingApp = this.apps.find((app, index) => 
                app.name.toLowerCase() === sanitizedName.toLowerCase() && index !== appIndex
            );
            if (existingApp) {
                return { success: false, message: "App with this name already exists" };
            }

            this.apps[appIndex].name = sanitizedName;
        }

        if (data.downloadUrl) {
            const validation = securityManager.validateURL(data.downloadUrl);
            if (!validation.valid) return { success: false, message: "Invalid URL" };
            const sanitizedUrl = validation.sanitized.trim();

            if (!this.isValidURL(sanitizedUrl)) {
                return { success: false, message: "Invalid URL format" };
            }
            this.apps[appIndex].downloadUrl = sanitizedUrl;
        }

        this.apps[appIndex].updated = new Date().toISOString();

        this.saveToStorage().then(() => {
            console.log('[AppsManager] App edited and synced:', id);
        });

        securityManager.logSecurityEvent('APP_EDITED', { 
            appId: id,
            editedBy: userManager.currentUser ? userManager.currentUser.email : 'system'
        });

        return { success: true, app: this.apps[appIndex] };
    }

    async deleteApp(id) {
        const appIndex = this.apps.findIndex(app => app.id === id);

        if (appIndex === -1) {
            return { success: false, message: "App not found" };
        }

        if (typeof firebaseManager !== 'undefined' && firebaseManager.isInitialized) {
            try {
                const fbResult = await firebaseManager.deleteApp(id);
                if (!fbResult.success && !fbResult.offline) {
                    console.error('[AppsManager] Firebase delete failed:', fbResult.error);
                    return { success: false, message: "Failed to delete from database: " + fbResult.error };
                }
                console.log('[AppsManager] ✅ App deleted from Firebase:', id);
            } catch (error) {
                console.error('[AppsManager] Firebase delete error:', error);
                return { success: false, message: "Database error: " + error.message };
            }
        }

        this.apps.splice(appIndex, 1);
        
        try {
            securityManager.secureStore(CONFIG.STORAGE_KEYS.IPTV_APPS, this.apps);
            localStorage.setItem(CONFIG.STORAGE_KEYS.NEXT_APP_ID, this.nextAppId.toString());
        } catch (e) {
            console.error("Error saving Apps to storage:", e);
        }

        securityManager.logSecurityEvent('APP_DELETED', { 
            appId: id,
            deletedBy: userManager.currentUser ? userManager.currentUser.email : 'system'
        });

        return { success: true };
    }

    getAllApps() {
        const currentUser = userManager.currentUser;

        if (!currentUser) {
            return { success: false, message: "You must be logged in to view apps" };
        }

        const permissions = this.appsPermissions[currentUser.role];

        if (!permissions || !permissions.canView) {
            return { success: false, message: "You don't have permission to view apps" };
        }

        const sortedApps = [...this.apps].sort((a, b) => {
            return new Date(b.created) - new Date(a.created);
        });

        return { success: true, apps: sortedApps };
    }

    getAppById(id) {
        return this.apps.find(app => app.id === id);
    }

    canUserAddApp() {
        const currentUser = userManager.currentUser;
        if (!currentUser) return false;
        const permissions = this.appsPermissions[currentUser.role];
        return permissions ? permissions.canAdd : false;
    }

    canUserEditApp() {
        const currentUser = userManager.currentUser;
        if (!currentUser) return false;
        const permissions = this.appsPermissions[currentUser.role];
        return permissions ? permissions.canEdit : false;
    }

    canUserDeleteApp() {
        const currentUser = userManager.currentUser;
        if (!currentUser) return false;
        const permissions = this.appsPermissions[currentUser.role];
        return permissions ? permissions.canDelete : false;
    }

    isValidURL(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    copyToClipboard(text) {
        return navigator.clipboard.writeText(text).then(() => {
            return true;
        }).catch(err => {
            console.error('Failed to copy: ', err);
            return false;
        });
    }

    async saveToStorage() {
        try {
            securityManager.secureStore(CONFIG.STORAGE_KEYS.IPTV_APPS, this.apps);
            localStorage.setItem(CONFIG.STORAGE_KEYS.NEXT_APP_ID, this.nextAppId.toString());

            if (typeof firebaseManager !== 'undefined') {
                await firebaseManager.ensureInitialized();
                
                if (firebaseManager.isInitialized) {
                    console.log('[AppsManager] Syncing to Firebase...');
                    
                    const syncPromises = this.apps.map(app => 
                        firebaseManager.syncApp(app).catch(err => {
                            console.error('[AppsManager] Sync error for app', app.id, err);
                        })
                    );
                    
                    await Promise.all(syncPromises);
                    console.log('[AppsManager] ✅ Firebase sync complete');
                } else {
                    console.warn('[AppsManager] Firebase not initialized, data queued');
                }
            }
        } catch (e) {
            console.error("Error saving Apps to storage:", e);
        }
    }

    loadFromStorage() {
        try {
            const savedApps = securityManager.secureRetrieve(CONFIG.STORAGE_KEYS.IPTV_APPS);
            const savedNextAppId = localStorage.getItem(CONFIG.STORAGE_KEYS.NEXT_APP_ID);

            if (savedApps) {
                this.apps = savedApps;
            }

            if (savedNextAppId) {
                this.nextAppId = parseInt(savedNextAppId);
            }
        } catch (e) {
            console.error("Error loading Apps from storage:", e);
        }
    }
}

// ============================================
// TELEGRAM MANAGER (unchanged)
// ============================================
class TelegramManager {
    constructor() {
        this.links = {
            group: 'https://t.me/+IvjWx9QcwyQxYmI8',
            channel: 'https://t.me/+I53XLnP96PFjNDA0',
            contact: '@THE_PHANTOM_DZ'
        };
        this.telegramPermissions = JSON.parse(JSON.stringify(CONFIG.TELEGRAM_PERMISSIONS));
        this.loadFromStorage();
    }

    canUserView() {
        const currentUser = userManager.currentUser;
        if (!currentUser) return false;
        const permissions = this.telegramPermissions[currentUser.role];
        return permissions ? permissions.canView : false;
    }

    canUserEdit() {
        const currentUser = userManager.currentUser;
        if (!currentUser) return false;
        const permissions = this.telegramPermissions[currentUser.role];
        return permissions ? permissions.canEdit : false;
    }

    getLinks() {
        if (!this.canUserView()) {
            return { success: false, message: "You don't have permission to view Telegram links" };
        }
        return { success: true, links: this.links };
    }

    updateLinks(group, channel, contact) {
        if (!this.canUserEdit()) {
            securityManager.logSecurityEvent('UNAUTHORIZED_TELEGRAM_EDIT', { 
                attemptedBy: userManager.currentUser ? userManager.currentUser.email : 'unknown'
            });
            return { success: false, message: "You don't have permission to edit Telegram links" };
        }

        const validations = {
            group: group ? securityManager.validateURL(group) : { valid: true },
            channel: channel ? securityManager.validateURL(channel) : { valid: true },
            contact: contact ? securityManager.validateInput(contact, 'string') : { valid: true }
        };

        for (const [key, validation] of Object.entries(validations)) {
            if (!validation.valid) {
                return { success: false, message: `Invalid ${key} format` };
            }
        }

        if (group) this.links.group = validations.group.sanitized.trim();
        if (channel) this.links.channel = validations.channel.sanitized.trim();
        if (contact) this.links.contact = validations.contact.sanitized.trim();

        this.saveToStorage().then(() => {
            console.log('[TelegramManager] Links updated and synced');
        });

        securityManager.logSecurityEvent('TELEGRAM_LINKS_UPDATED', { 
            updatedBy: userManager.currentUser.email
        });

        return { success: true, links: this.links };
    }

    copyToClipboard(text) {
        return navigator.clipboard.writeText(text).then(() => {
            return true;
        }).catch(err => {
            console.error('Failed to copy: ', err);
            return false;
        });
    }

    async saveToStorage() {
        try {
            securityManager.secureStore(CONFIG.STORAGE_KEYS.TELEGRAM_LINKS, this.links);

            if (typeof firebaseManager !== 'undefined') {
                await firebaseManager.ensureInitialized();
                
                if (firebaseManager.isInitialized) {
                    console.log('[TelegramManager] Syncing to Firebase...');
                    
                    await firebaseManager.syncTelegramLinks(this.links).catch(err => {
                        console.error('[TelegramManager] Sync error:', err);
                    });
                    
                    console.log('[TelegramManager] ✅ Firebase sync complete');
                } else {
                    console.warn('[TelegramManager] Firebase not initialized, data queued');
                }
            }
        } catch (e) {
            console.error("Error saving Telegram links to storage:", e);
        }
    }

    loadFromStorage() {
        try {
            const savedLinks = securityManager.secureRetrieve(CONFIG.STORAGE_KEYS.TELEGRAM_LINKS);
            if (savedLinks) {
                this.links = savedLinks;
            }
        } catch (e) {
            console.error("Error loading Telegram links from storage:", e);
        }
    }
}

// ============================================
// INITIALIZE SYSTEMS
// ============================================
const notificationSystem = new GlassNotification();
const userManager = new UserManagement();
const macManager = new FreeMACManager();
const xtreamManager = new FreeXtreamManager();
const telegramManager = new TelegramManager();
const ticketManager = new TicketManager();
const iptvAppsManager = new IPTVAppsManager();

let debounceTimer;

// ============================================
// TICKET SYSTEM UI FUNCTIONS (unchanged)
// ============================================
const ticketSection = document.getElementById('ticket-section');
const newTicketSection = document.getElementById('new-ticket-section');
const ticketDetailSection = document.getElementById('ticket-detail-section');
const editTicketSection = document.getElementById('edit-ticket-section');
const deleteModal = document.getElementById('delete-confirm-modal');

const newTicketBtn = document.getElementById('new-ticket-btn');
const backToTicketsBtn = document.getElementById('back-to-tickets-btn');
const backToTicketsDetailBtn = document.getElementById('back-to-tickets-detail-btn');
const backFromEditBtn = document.getElementById('back-from-edit-btn');
const cancelNewTicketBtn = document.getElementById('cancel-new-ticket-btn');

const createTicketBtn = document.getElementById('create-ticket-btn');
const replyBtn = document.getElementById('reply-btn');

const ticketsTableBody = document.getElementById('tickets-table-body');

let ticketToDelete = null;

function updateTicketsList() {
    ticketsTableBody.innerHTML = '';

    const result = ticketManager.getTicketsForUser();

    if (!result.success) {
        ticketsTableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 30px;">
                    ${securityManager.sanitizeInput(result.message)}
                </td>
            </tr>
        `;
        return;
    }

    if (result.tickets.length === 0) {
        ticketsTableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px;">
                    <div class="empty-state">
                        <div class="empty-icon">
                            <i class="fas fa-ticket-alt"></i>
                        </div>
                        <div class="empty-text">No tickets found</div>
                        <div class="empty-subtext">Create your first ticket to get started</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const sortedTickets = [...result.tickets].sort((a, b) => {
        return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    sortedTickets.forEach(ticket => {
        const row = document.createElement('tr');
        row.dataset.ticketId = ticket.id;

        const canEdit = ticketManager.canEditTicket(ticket);
        const canDelete = ticketManager.canDeleteTicket(ticket);

        row.innerHTML = `
            <td>#${ticket.id}</td>
            <td>${ticket.subject}</td>
            <td>${ticketManager.getCategoryDisplay(ticket.category)}</td>
            <td><span class="status-badge ${ticketManager.getPriorityBadgeClass(ticket.priority)}">${ticket.priority.toUpperCase()}</span></td>
            <td><span class="status-badge ${ticketManager.getStatusBadgeClass(ticket.status)}">${ticket.status.toUpperCase()}</span></td>
            <td>${ticketManager.formatDate(ticket.createdAt)}</td>
            <td>${ticketManager.formatDate(ticket.updatedAt)}</td>
            <td class="actions-cell">
                <div class="ticket-actions">
                    ${canEdit ? `
                        <button class="ticket-action-btn edit-btn" data-ticket-id="${ticket.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                    ` : ''}
                    ${canDelete ? `
                        <button class="ticket-action-btn delete-btn" data-ticket-id="${ticket.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        `;

        ticketsTableBody.appendChild(row);
    });

    document.querySelectorAll('#tickets-table tbody tr').forEach(row => {
        const ticketId = parseInt(row.dataset.ticketId);

        row.addEventListener('click', function(e) {
            if (!e.target.closest('.ticket-actions')) {
                showTicketDetail(ticketId);
            }
        });
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const ticketId = parseInt(this.dataset.ticketId);
            showEditTicketForm(ticketId);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const ticketId = parseInt(this.dataset.ticketId);
            showDeleteConfirm(ticketId);
        });
    });
}

function showTicketDetail(ticketId) {
    const result = ticketManager.getTicketById(ticketId);

    if (!result.success) {
        notificationSystem.error('Error', result.message, 3);
        return;
    }

    const ticket = result.ticket;

    document.getElementById('ticket-detail-id').textContent = `#${ticket.id}`;
    document.getElementById('ticket-detail-title').textContent = ticket.subject;
    document.getElementById('ticket-detail-created').textContent = ticketManager.formatDate(ticket.createdAt);
    document.getElementById('ticket-detail-updated').textContent = ticketManager.formatDate(ticket.updatedAt);
    document.getElementById('ticket-detail-category').textContent = ticketManager.getCategoryDisplay(ticket.category);
    document.getElementById('ticket-detail-priority').textContent = ticket.priority.toUpperCase();
    document.getElementById('ticket-detail-status').textContent = ticket.status.toUpperCase();
    document.getElementById('ticket-detail-description').textContent = ticket.description;

    updateTicketMessages(ticket);

    const replySection = document.getElementById('reply-section');
    if (ticket.status === 'closed') {
        replySection.style.display = 'none';
    } else {
        replySection.style.display = 'block';
    }

    const editTicketBtn = document.getElementById('edit-ticket-btn');
    const deleteTicketBtn = document.getElementById('delete-ticket-btn');

    if (ticketManager.canEditTicket(ticket)) {
        editTicketBtn.style.display = 'inline-flex';
        editTicketBtn.dataset.ticketId = ticketId;
    } else {
        editTicketBtn.style.display = 'none';
    }

    if (ticketManager.canDeleteTicket(ticket)) {
        deleteTicketBtn.style.display = 'inline-flex';
        deleteTicketBtn.dataset.ticketId = ticketId;
    } else {
        deleteTicketBtn.style.display = 'none';
    }

    ticketDetailSection.dataset.ticketId = ticketId;

    hideAllSections();
    ticketDetailSection.style.display = 'block';
    document.getElementById('back-to-dashboard-btn').style.display = 'flex';
}

function updateTicketMessages(ticket) {
    const messagesContainer = document.getElementById('ticket-messages-container');
    messagesContainer.innerHTML = '';

    if (ticket.messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="empty-state" style="padding: 20px;">
                <div class="empty-icon">
                    <i class="far fa-comments"></i>
                </div>
                <div class="empty-text">No messages yet</div>
            </div>
        `;
        return;
    }

    const sortedMessages = [...ticket.messages].sort((a, b) => {
        return new Date(a.createdAt) - new Date(b.createdAt);
    });

    sortedMessages.forEach(message => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';

        const roleClass = ticketManager.getRoleBadgeClass(message.sender.role);

        messageDiv.innerHTML = `
            <div class="message-header">
                <div>
                    <span class="message-sender">${securityManager.sanitizeInput(message.sender.name)}</span>
                    <span class="message-role ${roleClass}">${message.sender.role.toUpperCase()}</span>
                </div>
                <div class="message-time">${ticketManager.formatDate(message.createdAt)}</div>
            </div>
        `;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = message.content;
        messageDiv.appendChild(contentDiv);

        messagesContainer.appendChild(messageDiv);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showNewTicketForm() {
    hideAllSections();
    newTicketSection.style.display = 'block';
    document.getElementById('back-to-dashboard-btn').style.display = 'flex';

    document.getElementById('ticket-subject').value = '';
    document.getElementById('ticket-description').value = '';
    document.getElementById('ticket-category').value = 'technical';
    document.getElementById('ticket-priority').value = 'medium';
}

function showTicketsList() {
    hideAllSections();
    ticketSection.style.display = 'block';
    document.getElementById('back-to-dashboard-btn').style.display = 'flex';

    updateTicketsList();
}

function createNewTicket() {
    const subject = document.getElementById('ticket-subject').value;
    const category = document.getElementById('ticket-category').value;
    const priority = document.getElementById('ticket-priority').value;
    const description = document.getElementById('ticket-description').value;

    const result = ticketManager.createTicket(subject, category, priority, description);

    if (result.success) {
        notificationSystem.success('Ticket Created', 'Your ticket has been submitted successfully', 3);
        showTicketDetail(result.ticket.id);
    } else {
        notificationSystem.error('Error', result.message, 3);
    }
}

function addReplyToTicket() {
    const ticketId = parseInt(ticketDetailSection.dataset.ticketId);
    const replyContent = document.getElementById('reply-input').value;

    const result = ticketManager.addMessageToTicket(ticketId, replyContent);

    if (result.success) {
        document.getElementById('reply-input').value = '';
        notificationSystem.success('Reply Sent', 'Your reply has been sent successfully', 3);
        showTicketDetail(ticketId);
    } else {
        notificationSystem.error('Error', result.message, 3);
    }
}

function showEditTicketForm(ticketId) {
    const result = ticketManager.getTicketById(ticketId);

    if (!result.success) {
        notificationSystem.error('Error', result.message, 3);
        return;
    }

    const ticket = result.ticket;

    document.getElementById('edit-ticket-id').value = ticket.id;
    document.getElementById('edit-ticket-subject').value = ticket.subject;
    document.getElementById('edit-ticket-category').value = ticket.category;
    document.getElementById('edit-ticket-priority').value = ticket.priority;
    document.getElementById('edit-ticket-description').value = ticket.description;

    hideAllSections();
    editTicketSection.style.display = 'block';
    document.getElementById('back-to-dashboard-btn').style.display = 'flex';
}

function saveTicketEdit() {
    const ticketId = parseInt(document.getElementById('edit-ticket-id').value);
    const subject = document.getElementById('edit-ticket-subject').value;
    const category = document.getElementById('edit-ticket-category').value;
    const priority = document.getElementById('edit-ticket-priority').value;
    const description = document.getElementById('edit-ticket-description').value;

    const result = ticketManager.updateTicket(ticketId, subject, category, priority, description);

    if (result.success) {
        notificationSystem.success('Ticket Updated', 'Your ticket has been updated successfully', 3);
        editTicketSection.style.display = 'none';
        showTicketDetail(ticketId);
    } else {
        notificationSystem.error('Error', result.message, 3);
    }
}

function showDeleteConfirm(ticketId) {
    const result = ticketManager.getTicketById(ticketId);

    if (!result.success) {
        notificationSystem.error('Error', result.message, 3);
        return;
    }

    const ticket = result.ticket;
    ticketToDelete = ticketId;

    document.getElementById('delete-ticket-id').textContent = `#${ticket.id}`;
    document.getElementById('delete-ticket-subject').textContent = ticket.subject;
    document.getElementById('delete-ticket-category').textContent = ticketManager.getCategoryDisplay(ticket.category);
    document.getElementById('delete-ticket-priority').textContent = ticket.priority.toUpperCase();
    document.getElementById('delete-ticket-status').textContent = ticket.status.toUpperCase();
    document.getElementById('delete-ticket-created').textContent = ticketManager.formatDate(ticket.createdAt);

    deleteModal.classList.add('active');
}

async function confirmDeleteTicket() {
    if (!ticketToDelete) return;

    const result = await ticketManager.deleteTicket(ticketToDelete);

    if (result.success) {
        notificationSystem.success('Ticket Deleted', result.message, 3);
        updateTicketsList();

        if (ticketDetailSection.style.display !== 'none') {
            showTicketsList();
        }

        closeDeleteModal();
    } else {
        notificationSystem.error('Error', result.message, 3);
        closeDeleteModal();
    }
}

function closeDeleteModal() {
    deleteModal.classList.remove('active');
    ticketToDelete = null;
}

function hideAllSections() {
    document.getElementById('dashboard-section').style.display = 'none';
    document.getElementById('user-management-section').style.display = 'none';
    document.getElementById('free-mac-section').style.display = 'none';
    document.getElementById('free-xtream-section').style.display = 'none';
    document.getElementById('login-form-container').style.display = 'none';
    document.getElementById('iptv-apps-section').style.display = 'none';
    ticketSection.style.display = 'none';
    newTicketSection.style.display = 'none';
    ticketDetailSection.style.display = 'none';
    editTicketSection.style.display = 'none';
    document.getElementById('telegram-section').style.display = 'none';
    document.getElementById('system-settings-section').style.display = 'none';
}

function showTicketSection() {
    hideAllSections();
    ticketSection.style.display = 'block';
    document.getElementById('back-to-dashboard-btn').style.display = 'flex';
    document.getElementById('header-logout-btn').style.display = 'flex';

    updateTicketsList();
}

// ============================================
// IPTV APPS SYSTEM UI FUNCTIONS (unchanged)
// ============================================
function updateIPTVAppsCards() {
    const iptvAppsCards = document.getElementById('iptv-apps-cards');
    iptvAppsCards.innerHTML = '';

    const result = iptvAppsManager.getAllApps();

    if (!result.success) {
        iptvAppsCards.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-mobile-alt"></i>
                </div>
                <div class="empty-text">${securityManager.sanitizeInput(result.message)}</div>
            </div>
        `;
        return;
    }

    if (result.apps.length === 0) {
        iptvAppsCards.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-mobile-alt"></i>
                </div>
                <div class="empty-text">No IPTV Apps found</div>
                <div class="empty-subtext">Add your first IPTV App to get started</div>
            </div>
        `;
        return;
    }

    result.apps.forEach(app => {
        const card = document.createElement('div');
        card.className = 'iptv-app-card';

        const createdDate = new Date(app.created).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        let actionButtons = '';
        if (iptvAppsManager.canUserEditApp()) {
            actionButtons += `
                <button class="edit-app-btn" data-app-id="${app.id}" title="Edit App">
                    <i class="fas fa-edit"></i>
                </button>
            `;
        }
        if (iptvAppsManager.canUserDeleteApp()) {
            actionButtons += `
                <button class="delete-app-btn" data-app-id="${app.id}" title="Delete App">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        }

        card.innerHTML = `
            <div class="app-card-header">
                <div class="app-icon-large">
                    <i class="fas fa-mobile-alt"></i>
                </div>
                <div class="app-info">
                    <div class="app-name">${securityManager.sanitizeInput(app.name)}</div>
                    <div class="app-id">#${app.id}</div>
                </div>
            </div>
            <div class="app-card-body">
                <div class="app-download-box">
                    <div class="app-download-label">
                        <i class="fas fa-download"></i>
                        Download Link
                    </div>
                    <div class="app-download-input-group">
                        <input type="text" class="app-download-input" value="${securityManager.sanitizeURL(app.downloadUrl)}" readonly id="app-url-${app.id}">
                        <button class="app-copy-btn" data-url="${securityManager.sanitizeURL(app.downloadUrl)}" title="Copy Link">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div class="app-card-footer">
                <span class="app-date">
                    <i class="far fa-calendar-alt"></i> ${createdDate}
                </span>
                <div class="app-actions">
                    ${actionButtons}
                </div>
            </div>
        `;

        iptvAppsCards.appendChild(card);
    });

    document.querySelectorAll('.edit-app-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const appId = parseInt(this.dataset.appId);
            openEditAppModal(appId);
        });
    });

    document.querySelectorAll('.delete-app-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const appId = parseInt(this.dataset.appId);
            openDeleteAppModal(appId);
        });
    });

    document.querySelectorAll('.app-copy-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const url = this.dataset.url;
            iptvAppsManager.copyToClipboard(url).then(() => {
                notificationSystem.success('Copied!', 'Download link copied to clipboard', 2);
            });
        });
    });
}

function showIPTVAppsSection() {
    hideAllSections();
    document.getElementById('iptv-apps-section').style.display = 'block';
    document.getElementById('back-to-dashboard-btn').style.display = 'flex';
    document.getElementById('header-logout-btn').style.display = 'flex';

    updateIPTVAppsCards();
    updateIPTVAppsAddButton();
}

function updateIPTVAppsAddButton() {
    const addBtn = document.getElementById('add-app-btn');
    if (iptvAppsManager.canUserAddApp()) {
        addBtn.style.display = 'flex';
    } else {
        addBtn.style.display = 'none';
    }
}

function openAddAppModal() {
    if (!iptvAppsManager.canUserAddApp()) {
        notificationSystem.error('Permission Denied', 'You do not have permission to add apps', 3);
        return;
    }

    document.getElementById('add-app-name').value = '';
    document.getElementById('add-app-url').value = '';
    document.getElementById('addAppModal').classList.add('active');
}

function openEditAppModal(appId) {
    const app = iptvAppsManager.getAppById(appId);
    if (!app) {
        notificationSystem.error('Error', 'App not found', 3);
        return;
    }

    if (!iptvAppsManager.canUserEditApp()) {
        notificationSystem.error('Permission Denied', 'You do not have permission to edit apps', 3);
        return;
    }

    document.getElementById('edit-app-id').value = app.id;
    document.getElementById('edit-app-name').value = app.name;
    document.getElementById('edit-app-url').value = app.downloadUrl;
    document.getElementById('editAppModal').classList.add('active');
}

function openDeleteAppModal(appId) {
    const app = iptvAppsManager.getAppById(appId);
    if (!app) {
        notificationSystem.error('Error', 'App not found', 3);
        return;
    }

    if (!iptvAppsManager.canUserDeleteApp()) {
        notificationSystem.error('Permission Denied', 'You do not have permission to delete apps', 3);
        return;
    }

    const deleteAppInfo = document.getElementById('deleteAppInfo');
    deleteAppInfo.innerHTML = `
        <div class="app-info-row">
            <span class="app-info-label">ID:</span>
            <span class="app-info-value">#${app.id}</span>
        </div>
        <div class="app-info-row">
            <span class="app-info-label">Name:</span>
            <span class="app-info-value">${securityManager.sanitizeInput(app.name)}</span>
        </div>
        <div class="app-info-row">
            <span class="app-info-label">URL:</span>
            <span class="app-info-value">${securityManager.sanitizeURL(app.downloadUrl)}</span>
        </div>
    `;

    document.getElementById('deleteAppModal').dataset.appId = appId;
    document.getElementById('deleteAppModal').classList.add('active');
}

function saveNewApp() {
    const name = document.getElementById('add-app-name').value;
    const url = document.getElementById('add-app-url').value;

    const result = iptvAppsManager.addApp(name, url);

    if (result.success) {
        notificationSystem.success('Success', 'IPTV App added successfully', 3);
        document.getElementById('addAppModal').classList.remove('active');
        updateIPTVAppsCards();
    } else {
        notificationSystem.error('Error', result.message, 3);
    }
}

function saveEditApp() {
    const appId = parseInt(document.getElementById('edit-app-id').value);
    const name = document.getElementById('edit-app-name').value;
    const url = document.getElementById('edit-app-url').value;

    const result = iptvAppsManager.editApp(appId, { name, downloadUrl: url });

    if (result.success) {
        notificationSystem.success('Success', 'IPTV App updated successfully', 3);
        document.getElementById('editAppModal').classList.remove('active');
        updateIPTVAppsCards();
    } else {
        notificationSystem.error('Error', result.message, 3);
    }
}

function confirmDeleteApp() {
    const appId = parseInt(document.getElementById('deleteAppModal').dataset.appId);

    const result = iptvAppsManager.deleteApp(appId);

    if (result.success) {
        notificationSystem.success('Success', 'IPTV App deleted successfully', 3);
        document.getElementById('deleteAppModal').classList.remove('active');
        updateIPTVAppsCards();
    } else {
        notificationSystem.error('Error', result.message, 3);
    }
}

// ============================================
// TELEGRAM SYSTEM UI FUNCTIONS (unchanged)
// ============================================
function updateTelegramCards() {
    const telegramCards = document.getElementById('telegram-cards');
    telegramCards.innerHTML = '';

    const result = telegramManager.getLinks();

    if (!result.success) {
        telegramCards.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fab fa-telegram"></i>
                </div>
                <div class="empty-text">${securityManager.sanitizeInput(result.message)}</div>
            </div>
        `;
        return;
    }

    const links = result.links;

    const groupCard = createTelegramCard({
        type: 'group',
        title: 'Telegram Group',
        icon: 'fa-users',
        value: links.group
    });
    telegramCards.appendChild(groupCard);

    const channelCard = createTelegramCard({
        type: 'channel',
        title: 'Telegram Channel',
        icon: 'fa-broadcast-tower',
        value: links.channel
    });
    telegramCards.appendChild(channelCard);

    const contactCard = createTelegramCard({
        type: 'contact',
        title: 'Private Contact',
        icon: 'fa-user-shield',
        value: links.contact
    });
    telegramCards.appendChild(contactCard);
}

function createTelegramCard({ type, title, icon, value }) {
    const card = document.createElement('div');
    card.className = 'telegram-card-item';

    card.innerHTML = `
        <div class="telegram-card-header">
            <div class="telegram-icon-large">
                <i class="fas ${icon}"></i>
            </div>
            <div class="telegram-title-text">${title}</div>
        </div>
        <div class="telegram-content">
            <div class="telegram-link-box">
                <input type="text" class="telegram-link-input" value="${securityManager.sanitizeURL(value)}" readonly id="telegram-${type}-input">
                <button class="telegram-copy-btn-large" data-type="${type}" title="Copy to Clipboard">
                    <i class="fas fa-copy"></i>
                    <span>Copy</span>
                </button>
            </div>
        </div>
    `;

    const copyBtn = card.querySelector('.telegram-copy-btn-large');
    copyBtn.addEventListener('click', function() {
        const type = this.dataset.type;
        const result = telegramManager.getLinks();
        if (result.success) {
            let textToCopy = '';
            if (type === 'group') textToCopy = result.links.group;
            else if (type === 'channel') textToCopy = result.links.channel;
            else if (type === 'contact') textToCopy = result.links.contact;

            telegramManager.copyToClipboard(textToCopy).then(() => {
                notificationSystem.success('Copied!', 'Telegram link copied to clipboard', 2);
            });
        }
    });

    return card;
}

function showTelegramSection() {
    hideAllSections();
    document.getElementById('telegram-section').style.display = 'block';
    document.getElementById('back-to-dashboard-btn').style.display = 'flex';
    document.getElementById('header-logout-btn').style.display = 'flex';

    updateTelegramCards();
    updateTelegramEditButton();
}

function updateTelegramEditButton() {
    const editBtn = document.getElementById('edit-telegram-btn');
    if (telegramManager.canUserEdit()) {
        editBtn.style.display = 'flex';
    } else {
        editBtn.style.display = 'none';
    }
}

function openEditTelegramModal() {
    if (!telegramManager.canUserEdit()) {
        notificationSystem.error('Permission Denied', 'You do not have permission to edit Telegram links', 3);
        return;
    }

    const result = telegramManager.getLinks();
    if (result.success) {
        document.getElementById('edit-telegram-group').value = result.links.group;
        document.getElementById('edit-telegram-channel').value = result.links.channel;
        document.getElementById('edit-telegram-contact').value = result.links.contact;

        document.getElementById('editTelegramModal').classList.add('active');
    }
}

function saveTelegramChanges() {
    const group = document.getElementById('edit-telegram-group').value;
    const channel = document.getElementById('edit-telegram-channel').value;
    const contact = document.getElementById('edit-telegram-contact').value;

    const result = telegramManager.updateLinks(group, channel, contact);

    if (result.success) {
        notificationSystem.success('Success', 'Telegram links updated successfully', 3);
        document.getElementById('editTelegramModal').classList.remove('active');
        updateTelegramCards();
    } else {
        notificationSystem.error('Error', result.message, 3);
    }
}

// ============================================
// USER MANAGEMENT UI FUNCTIONS - EMAIL VERSION
// ============================================
function showSection(sectionId) {
    hideAllSections();
    document.getElementById(sectionId).style.display = 'block';
    document.getElementById('back-to-dashboard-btn').style.display = 'flex';
    document.getElementById('header-logout-btn').style.display = 'flex';
}

function updateUsersTable() {
    const usersTableBody = document.getElementById('users-table-body');
    usersTableBody.innerHTML = '';

    const result = userManager.getAllUsers();

    if (!result.success) {
        notificationSystem.error('Error', result.message, 3);
        return;
    }

    // ✅ Debug: Log users count
    console.log('[updateUsersTable] Total users:', result.users.length);
    console.log('[updateUsersTable] User IDs:', result.users.map(u => ({ id: u.id, email: u.email })));

    result.users.forEach(user => {
        const row = document.createElement('tr');

        const roleBadge = `<span class="role-badge role-${user.role}">${user.role.toUpperCase()}</span>`;
        const statusBadge = user.banned ? 
            '<span class="status-badge status-banned">BANNED</span>' : 
            '<span class="status-badge status-active">ACTIVE</span>';
        
        const verifiedBadge = user.emailVerified ? 
            '<span class="verified-badge" title="Email Verified"><i class="fas fa-check-circle"></i></span>' : 
            '<span class="unverified-badge" title="Email Not Verified"><i class="fas fa-exclamation-circle"></i></span>';

        const createdDate = new Date(user.created).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        let actionButtons = '';

        if (userManager.canPerformAction('edit_user')) {
            actionButtons += `
                <button class="action-btn edit-btn-table" data-user-id="${user.id}" title="Edit User">
                    <i class="fas fa-edit"></i>
                </button>
            `;
        }

        if (user.banned) {
            if (userManager.canPerformAction('unban_user')) {
                actionButtons += `
                    <button class="action-btn unban-btn" data-user-id="${user.id}" title="Unban User">
                        <i class="fas fa-user-check"></i>
                    </button>
                `;
            }
        } else {
            if (userManager.canPerformAction('ban_user')) {
                actionButtons += `
                    <button class="action-btn ban-btn" data-user-id="${user.id}" title="Ban User">
                        <i class="fas fa-user-slash"></i>
                    </button>
                `;
            }
        }

        if (userManager.canPerformAction('delete_user')) {
            actionButtons += `
                <button class="action-btn delete-btn-table" data-user-id="${user.id}" title="Delete User">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        }

        row.innerHTML = `
            <td>${user.id}</td>
            <td>${securityManager.sanitizeInput(user.name)}</td>
            <td>${securityManager.sanitizeInput(user.email)} ${verifiedBadge}</td>
            <td>${roleBadge}</td>
            <td>${statusBadge}</td>
            <td>${createdDate}</td>
            <td>
                <div class="action-buttons">
                    ${actionButtons}
                </div>
            </td>
        `;

        usersTableBody.appendChild(row);
    });

    document.querySelectorAll('.edit-btn-table').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.dataset.userId; // ✅ Keep as string
            openEditModal(userId);
        });
    });

    document.querySelectorAll('.ban-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.dataset.userId; // ✅ Keep as string
            banUser(userId);
        });
    });

    document.querySelectorAll('.unban-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.dataset.userId; // ✅ Keep as string
            unbanUser(userId);
        });
    });

    document.querySelectorAll('.delete-btn-table').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.dataset.userId; // ✅ Keep as string
            openDeleteModal(userId);
        });
    });
}

// ============================================
// FREE MAC UI FUNCTIONS (unchanged)
// ============================================
function updateFreeMACCards() {
    const freeMacCards = document.getElementById('free-mac-cards');
    freeMacCards.innerHTML = '';

    const result = macManager.getAllMACs();

    if (!result.success) {
        freeMacCards.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-tv"></i>
                </div>
                <div class="empty-text">${securityManager.sanitizeInput(result.message)}</div>
            </div>
        `;
        return;
    }

    if (result.macs.length === 0) {
        freeMacCards.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-tv"></i>
                </div>
                <div class="empty-text">No MAC addresses found</div>
                <div class="empty-subtext">Add your first MAC address to get started</div>
            </div>
        `;
        return;
    }

    result.macs.forEach(mac => {
        const card = document.createElement('div');
        card.className = `mac-card ${mac.status === 'expired' ? 'expired' : ''}`;

        const expiryDate = new Date(mac.expiryDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const statusBadge = mac.status === 'expired' ? 
            '<span class="mac-card-status status-expired">EXPIRED</span>' : 
            `<span class="mac-card-status status-active">ACTIVE (${mac.daysLeft} days)</span>`;

        let actionButtons = '';
        if (macManager.canUserEditMAC()) {
            actionButtons += `
                <button class="edit-mac-btn" data-mac-id="${mac.id}" title="Edit MAC">
                    <i class="fas fa-edit"></i>
                </button>
            `;
        }
        if (macManager.canUserDeleteMAC()) {
            actionButtons += `
                <button class="delete-mac-btn" data-mac-id="${mac.id}" title="Delete MAC">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        }

        card.innerHTML = `
            <div class="mac-card-header">
                <span class="mac-card-id">MAC #${mac.id}</span>
                ${statusBadge}
            </div>
            <div class="mac-info">
                <div class="mac-info-row">
                    <span class="info-label">URL:</span>
                    <span class="info-value">${securityManager.sanitizeURL(mac.url)}</span>
                    <button class="copy-btn-small" data-copy="${securityManager.sanitizeURL(mac.url)}" title="Copy URL">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <div class="mac-info-row">
                    <span class="info-label">MAC:</span>
                    <span class="info-value">${securityManager.sanitizeInput(mac.macAddress)}</span>
                    <button class="copy-btn-small" data-copy="${securityManager.sanitizeInput(mac.macAddress)}" title="Copy MAC">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
            <div class="mac-card-footer">
                <span class="mac-expiry">
                    <i class="far fa-calendar-alt"></i> Expires: ${expiryDate}
                </span>
                <div class="mac-actions">
                    ${actionButtons}
                </div>
            </div>
        `;

        freeMacCards.appendChild(card);
    });

    document.querySelectorAll('.edit-mac-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const macId = parseInt(this.dataset.macId);
            openEditMacModal(macId);
        });
    });

    document.querySelectorAll('.delete-mac-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const macId = parseInt(this.dataset.macId);
            openDeleteMacModal(macId);
        });
    });

    document.querySelectorAll('.copy-btn-small').forEach(btn => {
        btn.addEventListener('click', function() {
            const text = this.dataset.copy;
            navigator.clipboard.writeText(text).then(() => {
                notificationSystem.success('Copied!', 'Text copied to clipboard', 2);
            });
        });
    });
}

// ============================================
// FREE XTREAM UI FUNCTIONS (unchanged)
// ============================================
function updateFreeXtreamCards() {
    const freeXtreamCards = document.getElementById('free-xtream-cards');
    freeXtreamCards.innerHTML = '';

    const result = xtreamManager.getAllXtreams();

    if (!result.success) {
        freeXtreamCards.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-satellite-dish"></i>
                </div>
                <div class="empty-text">${securityManager.sanitizeInput(result.message)}</div>
            </div>
        `;
        return;
    }

    if (result.xtreams.length === 0) {
        freeXtreamCards.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-satellite-dish"></i>
                </div>
                <div class="empty-text">No Xtream accounts found</div>
                <div class="empty-subtext">Add your first Xtream account to get started</div>
            </div>
        `;
        return;
    }

    result.xtreams.forEach(xtream => {
        const card = document.createElement('div');
        card.className = `xtream-card ${xtream.status === 'expired' ? 'expired' : ''}`;

        const expiryDate = new Date(xtream.expiryDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const statusBadge = xtream.status === 'expired' ? 
            '<span class="xtream-card-status status-expired">EXPIRED</span>' : 
            `<span class="xtream-card-status status-active">ACTIVE (${xtream.daysLeft} days)</span>`;

        let actionButtons = '';
        if (xtreamManager.canUserEditXtream()) {
            actionButtons += `
                <button class="edit-xtream-btn" data-xtream-id="${xtream.id}" title="Edit Xtream">
                    <i class="fas fa-edit"></i>
                </button>
            `;
        }
        if (xtreamManager.canUserDeleteXtream()) {
            actionButtons += `
                <button class="delete-xtream-btn" data-xtream-id="${xtream.id}" title="Delete Xtream">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        }

        card.innerHTML = `
            <div class="xtream-card-header">
                <span class="xtream-card-id">Xtream #${xtream.id}</span>
                ${statusBadge}
            </div>
            <div class="xtream-info">
                <div class="xtream-info-row">
                    <span class="info-label">URL:</span>
                    <span class="info-value">${securityManager.sanitizeURL(xtream.url)}</span>
                    <button class="copy-btn-small" data-copy="${securityManager.sanitizeURL(xtream.url)}" title="Copy URL">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <div class="xtream-info-row">
                    <span class="info-label">User:</span>
                    <span class="info-value">${securityManager.sanitizeInput(xtream.username)}</span>
                    <button class="copy-btn-small" data-copy="${securityManager.sanitizeInput(xtream.username)}" title="Copy Username">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <div class="xtream-info-row">
                    <span class="info-label">Pass:</span>
                    <span class="info-value">${securityManager.sanitizeInput(xtream.password)}</span>
                    <button class="copy-btn-small" data-copy="${securityManager.sanitizeInput(xtream.password)}" title="Copy Password">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
            <div class="xtream-card-footer">
                <span class="xtream-expiry">
                    <i class="far fa-calendar-alt"></i> Expires: ${expiryDate}
                </span>
                <div class="xtream-actions">
                    ${actionButtons}
                </div>
            </div>
        `;

        freeXtreamCards.appendChild(card);
    });

    document.querySelectorAll('.edit-xtream-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const xtreamId = parseInt(this.dataset.xtreamId);
            openEditXtreamModal(xtreamId);
        });
    });

    document.querySelectorAll('.delete-xtream-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const xtreamId = parseInt(this.dataset.xtreamId);
            openDeleteXtreamModal(xtreamId);
        });
    });

    document.querySelectorAll('.copy-btn-small').forEach(btn => {
        btn.addEventListener('click', function() {
            const text = this.dataset.copy;
            navigator.clipboard.writeText(text).then(() => {
                notificationSystem.success('Copied!', 'Text copied to clipboard', 2);
            });
        });
    });
}

// ============================================
// MODAL FUNCTIONS - EMAIL VERSION
// ============================================
function openEditModal(userId) {
    const user = userManager.getUserById(userId);
    if (!user) {
        notificationSystem.error('Error', 'User not found', 3);
        return;
    }

    document.getElementById('edit-user-name').value = user.name;
    document.getElementById('edit-user-email').value = user.email;

    document.querySelectorAll('#edit-role-selector .role-option').forEach(option => {
        option.classList.remove('selected');
        if (option.dataset.role === user.role) {
            option.classList.add('selected');
        }
    });

    document.getElementById('modalTitle').textContent = 'Edit User #' + user.id;
    document.getElementById('editUserModal').classList.add('active');
    document.getElementById('editUserModal').dataset.userId = userId;
}

function openDeleteModal(userId) {
    const user = userManager.getUserById(userId);
    if (!user) {
        notificationSystem.error('Error', 'User not found', 3);
        return;
    }

    const deleteUserInfo = document.getElementById('deleteUserInfo');
    deleteUserInfo.innerHTML = `
        <div class="user-info-row">
            <span class="user-info-label">ID:</span>
            <span class="user-info-value">#${user.id}</span>
        </div>
        <div class="user-info-row">
            <span class="user-info-label">Name:</span>
            <span class="user-info-value">${securityManager.sanitizeInput(user.name)}</span>
        </div>
        <div class="user-info-row">
            <span class="user-info-label">Email:</span>
            <span class="user-info-value">${securityManager.sanitizeInput(user.email)}</span>
        </div>
        <div class="user-info-row">
            <span class="user-info-label">Role:</span>
            <span class="user-info-value">${user.role.toUpperCase()}</span>
        </div>
    `;

    document.getElementById('deleteUserModal').classList.add('active');
    document.getElementById('deleteUserModal').dataset.userId = userId;
}

function openEditMacModal(macId) {
    const mac = macManager.getMACById(macId);
    if (!mac) {
        notificationSystem.error('Error', 'MAC not found', 3);
        return;
    }

    document.getElementById('edit-mac-url').value = mac.url;
    document.getElementById('edit-mac-address').value = mac.macAddress;
    document.getElementById('edit-mac-expiry').value = mac.expiryDate;

    document.getElementById('editMacModal').classList.add('active');
    document.getElementById('editMacModal').dataset.macId = macId;
}

function openDeleteMacModal(macId) {
    const mac = macManager.getMACById(macId);
    if (!mac) {
        notificationSystem.error('Error', 'MAC not found', 3);
        return;
    }

    const deleteMacInfo = document.getElementById('deleteMacInfo');
    deleteMacInfo.innerHTML = `
        <div class="mac-info-row">
            <span class="mac-info-label">ID:</span>
            <span class="mac-info-value">#${mac.id}</span>
        </div>
        <div class="mac-info-row">
            <span class="mac-info-label">URL:</span>
            <span class="mac-info-value">${securityManager.sanitizeURL(mac.url)}</span>
        </div>
        <div class="mac-info-row">
            <span class="mac-info-label">MAC:</span>
            <span class="mac-info-value">${securityManager.sanitizeInput(mac.macAddress)}</span>
        </div>
    `;

    document.getElementById('deleteMacModal').classList.add('active');
    document.getElementById('deleteMacModal').dataset.macId = macId;
}

function openEditXtreamModal(xtreamId) {
    const xtream = xtreamManager.getXtreamById(xtreamId);
    if (!xtream) {
        notificationSystem.error('Error', 'Xtream not found', 3);
        return;
    }

    document.getElementById('edit-xtream-url').value = xtream.url;
    document.getElementById('edit-xtream-username').value = xtream.username;
    document.getElementById('edit-xtream-password').value = '';
    document.getElementById('edit-xtream-expiry').value = xtream.expiryDate;

    document.getElementById('editXtreamModal').classList.add('active');
    document.getElementById('editXtreamModal').dataset.xtreamId = xtreamId;
}

function openDeleteXtreamModal(xtreamId) {
    const xtream = xtreamManager.getXtreamById(xtreamId);
    if (!xtream) {
        notificationSystem.error('Error', 'Xtream not found', 3);
        return;
    }

    const deleteXtreamInfo = document.getElementById('deleteXtreamInfo');
    deleteXtreamInfo.innerHTML = `
        <div class="xtream-info-row">
            <span class="xtream-info-label">ID:</span>
            <span class="xtream-info-value">#${xtream.id}</span>
        </div>
        <div class="xtream-info-row">
            <span class="xtream-info-label">URL:</span>
            <span class="xtream-info-value">${securityManager.sanitizeURL(xtream.url)}</span>
        </div>
        <div class="xtream-info-row">
            <span class="xtream-info-label">Username:</span>
            <span class="xtream-info-value">${securityManager.sanitizeInput(xtream.username)}</span>
        </div>
    `;

    document.getElementById('deleteXtreamModal').classList.add('active');
    document.getElementById('deleteXtreamModal').dataset.xtreamId = xtreamId;
}

async function banUser(userId) {
    try {
        const result = await userManager.banUser(userId);
        if (result.success) {
            notificationSystem.success('User Banned', `User "${result.user.email}" has been banned`, 3);
            updateUsersTable();
        } else {
            notificationSystem.error('Error', result.message, 3);
        }
    } catch (error) {
        console.error('Ban user error:', error);
        notificationSystem.error('Error', 'Failed to ban user: ' + (error.message || 'Unknown error'), 3);
    }
}

async function unbanUser(userId) {
    try {
        const result = await userManager.unbanUser(userId);
        if (result.success) {
            notificationSystem.success('User Unbanned', `User "${result.user.email}" has been unbanned`, 3);
            updateUsersTable();
        } else {
            notificationSystem.error('Error', result.message, 3);
        }
    } catch (error) {
        console.error('Unban user error:', error);
        notificationSystem.error('Error', 'Failed to unban user: ' + (error.message || 'Unknown error'), 3);
    }
}

function updateDateTime() {
    const now = new Date();

    const dateOptions = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };

    const timeOptions = { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true 
    };

    const dateStr = now.toLocaleDateString('en-US', dateOptions);
    const timeStr = now.toLocaleTimeString('en-US', timeOptions);

    document.getElementById('date').textContent = dateStr;
    document.getElementById('time').textContent = timeStr;
}

setInterval(updateDateTime, 1000);
updateDateTime();

// ============================================
// EVENT LISTENERS - FORM SWITCHING - EMAIL VERSION
// ============================================
document.getElementById('show-register').addEventListener('click', function() {
    document.getElementById('login-section').classList.remove('active');
    document.getElementById('register-section').classList.add('active');
});

document.getElementById('show-login').addEventListener('click', function() {
    document.getElementById('register-section').classList.remove('active');
    document.getElementById('login-section').classList.add('active');
});

document.getElementById('show-forgot').addEventListener('click', function() {
    document.getElementById('login-section').classList.remove('active');
    document.getElementById('forgot-section').classList.add('active');
});

document.getElementById('show-login2').addEventListener('click', function() {
    document.getElementById('forgot-section').classList.remove('active');
    document.getElementById('login-section').classList.add('active');
});

// Role Selection
document.querySelectorAll('.role-option').forEach(option => {
    option.addEventListener('click', function() {
        const selector = this.parentElement;
        selector.querySelectorAll('.role-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        this.classList.add('selected');
    });
});

// Password Toggle
document.querySelectorAll('.password-toggle').forEach(toggle => {
    toggle.addEventListener('click', function() {
        const targetId = this.dataset.target;
        const input = document.getElementById(targetId);
        const icon = this.querySelector('i');

        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
            this.classList.add('active');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
            this.classList.remove('active');
        }
    });
});

// ============================================
// LOGIN / REGISTER / FORGOT PASSWORD - EMAIL VERSION
// ============================================
document.getElementById('login-btn').addEventListener('click', async function() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        notificationSystem.error('Error', 'Please enter both email and password', 3);
        return;
    }

    if (!EmailValidator.validate(email)) {
        notificationSystem.error('Error', 'Please enter a valid email address', 3);
        return;
    }

    const result = await userManager.login(email, password);

    if (result.success) {
        notificationSystem.success('Welcome!', `Logged in as ${result.user.role.toUpperCase()}`, 3);

        ticketManager.currentUser = result.user;

        hideAllSections();
        document.getElementById('dashboard-section').style.display = 'block';
        document.getElementById('header-logout-btn').style.display = 'flex';

        updateDashboardCards();
    } else if (result.needsVerification) {
        notificationSystem.warning('Email Not Verified', result.message, 5);
        // Show resend verification option
        showResendVerification(result.email);
    } else {
        notificationSystem.error('Login Failed', result.message, 3);
    }
});

document.getElementById('register-btn').addEventListener('click', async function() {
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;

    if (!name || !email || !password) {
        notificationSystem.error('Error', 'Please fill in all fields', 3);
        return;
    }

    if (!EmailValidator.validate(email)) {
        notificationSystem.error('Error', 'Please enter a valid email address', 3);
        return;
    }

    if (password !== confirm) {
        notificationSystem.error('Error', 'Passwords do not match', 3);
        return;
    }

    if (password.length < CONFIG.SYSTEM.MIN_PASSWORD_LENGTH) {
        notificationSystem.error('Error', `Password must be at least ${CONFIG.SYSTEM.MIN_PASSWORD_LENGTH} characters`, 3);
        return;
    }

    const result = await userManager.register(name, email, password);

    if (result.success) {
        notificationSystem.success('Success', result.message || 'Account created successfully! Please verify your email.', 5);
        document.getElementById('register-section').classList.remove('active');
        document.getElementById('login-section').classList.add('active');

        document.getElementById('register-name').value = '';
        document.getElementById('register-email').value = '';
        document.getElementById('register-password').value = '';
        document.getElementById('register-confirm').value = '';
    } else {
        notificationSystem.error('Registration Failed', result.message, 3);
    }
});

document.getElementById('forgot-btn').addEventListener('click', async function() {
    const email = document.getElementById('forgot-email').value;

    if (!email) {
        notificationSystem.error('Error', 'Please enter your email address', 3);
        return;
    }

    if (!EmailValidator.validate(email)) {
        notificationSystem.error('Error', 'Please enter a valid email address', 3);
        return;
    }

    const result = await userManager.sendPasswordReset(email);

    if (result.success) {
        notificationSystem.success('Success', result.message, 5);
        document.getElementById('forgot-section').classList.remove('active');
        document.getElementById('login-section').classList.add('active');
        document.getElementById('forgot-email').value = '';
    } else {
        notificationSystem.error('Error', result.error, 3);
    }
});

// Resend Verification Email
async function showResendVerification(email) {
    const resendBtn = document.createElement('button');
    resendBtn.className = 'resend-verification-btn';
    resendBtn.textContent = 'Resend Verification Email';
    resendBtn.onclick = async function() {
        const result = await userManager.resendVerificationEmail();
        if (result.success) {
            notificationSystem.success('Sent', result.message, 3);
        } else {
            notificationSystem.error('Error', result.error, 3);
        }
    };
    
    const loginSection = document.getElementById('login-section');
    if (!loginSection.querySelector('.resend-verification-btn')) {
        loginSection.appendChild(resendBtn);
    }
}

// Logout
document.getElementById('header-logout-btn').addEventListener('click', function() {
    userManager.logout();
    ticketManager.currentUser = null;
    notificationSystem.info('Logged Out', 'You have been logged out', 3);

    hideAllSections();
    document.getElementById('login-form-container').style.display = 'block';
    document.getElementById('login-section').classList.add('active');
    document.getElementById('header-logout-btn').style.display = 'none';
    document.getElementById('back-to-dashboard-btn').style.display = 'none';

    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
});

// Back to Dashboard
document.getElementById('back-to-dashboard-btn').addEventListener('click', function() {
    hideAllSections();
    document.getElementById('dashboard-section').style.display = 'block';
    document.getElementById('back-to-dashboard-btn').style.display = 'none';
});

// ============================================
// DASHBOARD CARDS
// ============================================
document.getElementById('user-management-card').addEventListener('click', function() {
    showSection('user-management-section');
    updateUsersTable();
});

document.getElementById('settings-card').addEventListener('click', function() {
    showSystemSettingsSection();
});

document.getElementById('free-mac-card').addEventListener('click', function() {
    showSection('free-mac-section');
    updateFreeMACCards();
});

document.getElementById('free-xtream-card').addEventListener('click', function() {
    showSection('free-xtream-section');
    updateFreeXtreamCards();
});

document.getElementById('ticket-system-card').addEventListener('click', function() {
    showTicketSection();
});

document.getElementById('iptv-apps-card').addEventListener('click', function() {
    showIPTVAppsSection();
});

document.getElementById('telegram-card').addEventListener('click', function() {
    showTelegramSection();
});

// ============================================
// ADD BUTTONS
// ============================================
document.getElementById('add-user-btn').addEventListener('click', function() {
    document.getElementById('addUserModal').classList.add('active');
});

document.getElementById('add-mac-btn').addEventListener('click', function() {
    if (macManager.canUserAddMAC()) {
        document.getElementById('addMacModal').classList.add('active');
    } else {
        notificationSystem.error('Permission Denied', 'You do not have permission to add MAC addresses', 3);
    }
});

document.getElementById('add-xtream-btn').addEventListener('click', function() {
    if (xtreamManager.canUserAddXtream()) {
        document.getElementById('addXtreamModal').classList.add('active');
    } else {
        notificationSystem.error('Permission Denied', 'You do not have permission to add Xtream accounts', 3);
    }
});

document.getElementById('add-app-btn').addEventListener('click', function() {
    openAddAppModal();
});

document.getElementById('edit-telegram-btn').addEventListener('click', function() {
    openEditTelegramModal();
});

// ============================================
// MODAL EVENT LISTENERS - USER MANAGEMENT - EMAIL VERSION
// ============================================

// Edit User Modal
document.getElementById('modalClose').addEventListener('click', function() {
    document.getElementById('editUserModal').classList.remove('active');
});

document.getElementById('modalCancel').addEventListener('click', function() {
    document.getElementById('editUserModal').classList.remove('active');
});

document.getElementById('modalSave').addEventListener('click', async function() {
    const userId = document.getElementById('editUserModal').dataset.userId; // ✅ إزالة parseInt
    const name = document.getElementById('edit-user-name').value;
    const email = document.getElementById('edit-user-email').value;
    const password = document.getElementById('edit-user-password').value;
    const selectedRole = document.querySelector('#edit-role-selector .role-option.selected');
    const role = selectedRole ? selectedRole.dataset.role : 'user';

    if (!name || !email) {
        notificationSystem.error('Error', 'Name and email are required', 3);
        return;
    }

    if (!EmailValidator.validate(email)) {
        notificationSystem.error('Error', 'Please enter a valid email address', 3);
        return;
    }

    const data = { name, email, role };
    if (password) {
        data.password = password;
    }

    const result = await userManager.updateUser(userId, data); // ✅ userId هو نص الآن

    if (result.success) {
        notificationSystem.success('Success', 'User updated successfully', 3);
        document.getElementById('editUserModal').classList.remove('active');
        updateUsersTable();
    } else {
        notificationSystem.error('Error', result.message, 3);
    }
});

// Add User Modal
document.getElementById('addModalClose').addEventListener('click', function() {
    document.getElementById('addUserModal').classList.remove('active');
});

document.getElementById('addModalCancel').addEventListener('click', function() {
    document.getElementById('addUserModal').classList.remove('active');
});

document.getElementById('addModalSave').addEventListener('click', async function() {
    const name = document.getElementById('add-user-name').value;
    const email = document.getElementById('add-user-email').value;
    const password = document.getElementById('add-user-password').value;
    const confirm = document.getElementById('add-user-confirm').value;
    const selectedRole = document.querySelector('#add-role-selector .role-option.selected');
    const role = selectedRole ? selectedRole.dataset.role : 'user';

    if (!name || !email || !password) {
        notificationSystem.error('Error', 'All fields are required', 3);
        return;
    }

    if (!EmailValidator.validate(email)) {
        notificationSystem.error('Error', 'Please enter a valid email address', 3);
        return;
    }

    if (password !== confirm) {
        notificationSystem.error('Error', 'Passwords do not match', 3);
        return;
    }

    const result = await userManager.register(name, email, password, role);

    if (result.success) {
        notificationSystem.success('Success', result.message || 'User created successfully', 3);
        document.getElementById('addUserModal').classList.remove('active');

        document.getElementById('add-user-name').value = '';
        document.getElementById('add-user-email').value = '';
        document.getElementById('add-user-password').value = '';
        document.getElementById('add-user-confirm').value = '';

        updateUsersTable();
    } else {
        notificationSystem.error('Error', result.message, 3);
    }
});

// Delete User Modal
document.getElementById('deleteModalClose').addEventListener('click', function() {
    document.getElementById('deleteUserModal').classList.remove('active');
});

document.getElementById('deleteModalCancel').addEventListener('click', function() {
    document.getElementById('deleteUserModal').classList.remove('active');
});

document.getElementById('deleteModalConfirm').addEventListener('click', async function() {
    const userId = document.getElementById('deleteUserModal').dataset.userId; // ✅ إزالة parseInt

    try {
        const result = await userManager.deleteUser(userId); // ✅ userId هو نص الآن

        if (result.success) {
            notificationSystem.success('Success', 'User deleted successfully', 3);
            document.getElementById('deleteUserModal').classList.remove('active');
            updateUsersTable();
        } else {
            notificationSystem.error('Error', result.message, 3);
        }
    } catch (error) {
        console.error('Delete user error:', error);
        notificationSystem.error('Error', 'Failed to delete user: ' + (error.message || 'Unknown error'), 3);
    }
});


// ============================================
// MODAL EVENT LISTENERS - MAC MANAGEMENT (unchanged)
// ============================================

// Add MAC Modal
document.getElementById('addMacModalClose').addEventListener('click', function() {
    document.getElementById('addMacModal').classList.remove('active');
});

document.getElementById('addMacModalCancel').addEventListener('click', function() {
    document.getElementById('addMacModal').classList.remove('active');
});

document.getElementById('addMacModalSave').addEventListener('click', function() {
    const url = document.getElementById('add-mac-url').value;
    const macAddress = document.getElementById('add-mac-address').value;
    const expiryDate = document.getElementById('add-mac-expiry').value;

    if (!url || !macAddress || !expiryDate) {
        notificationSystem.error('Error', 'All fields are required', 3);
        return;
    }

    const result = macManager.addMAC(url, macAddress, expiryDate);

    if (result.success) {
        notificationSystem.success('Success', 'MAC added successfully', 3);
        document.getElementById('addMacModal').classList.remove('active');

        document.getElementById('add-mac-url').value = '';
        document.getElementById('add-mac-address').value = '';
        document.getElementById('add-mac-expiry').value = '';

        updateFreeMACCards();
    } else {
        notificationSystem.error('Error', result.message, 3);
    }
});

// Edit MAC Modal
document.getElementById('editMacModalClose').addEventListener('click', function() {
    document.getElementById('editMacModal').classList.remove('active');
});

document.getElementById('editMacModalCancel').addEventListener('click', function() {
    document.getElementById('editMacModal').classList.remove('active');
});

document.getElementById('editMacModalSave').addEventListener('click', function() {
    const macId = parseInt(document.getElementById('editMacModal').dataset.macId);
    const url = document.getElementById('edit-mac-url').value;
    const macAddress = document.getElementById('edit-mac-address').value;
    const expiryDate = document.getElementById('edit-mac-expiry').value;

    if (!url || !macAddress || !expiryDate) {
        notificationSystem.error('Error', 'All fields are required', 3);
        return;
    }

    const result = macManager.editMAC(macId, { url, macAddress, expiryDate });

    if (result.success) {
        notificationSystem.success('Success', 'MAC updated successfully', 3);
        document.getElementById('editMacModal').classList.remove('active');
        updateFreeMACCards();
    } else {
        notificationSystem.error('Error', result.message, 3);
    }
});

// Delete MAC Modal
document.getElementById('deleteMacModalClose').addEventListener('click', function() {
    document.getElementById('deleteMacModal').classList.remove('active');
});

document.getElementById('deleteMacModalCancel').addEventListener('click', function() {
    document.getElementById('deleteMacModal').classList.remove('active');
});

document.getElementById('deleteMacModalConfirm').addEventListener('click', async function() {
    const macId = parseInt(document.getElementById('deleteMacModal').dataset.macId);

    const result = await macManager.deleteMAC(macId);

    if (result.success) {
        notificationSystem.success('Success', 'MAC deleted successfully', 3);
        document.getElementById('deleteMacModal').classList.remove('active');
        updateFreeMACCards();
    } else {
        notificationSystem.error('Error', result.message, 3);
    }
});

// ============================================
// MODAL EVENT LISTENERS - XTREAM MANAGEMENT (unchanged)
// ============================================

// Add Xtream Modal
document.getElementById('addXtreamModalClose').addEventListener('click', function() {
    document.getElementById('addXtreamModal').classList.remove('active');
});

document.getElementById('addXtreamModalCancel').addEventListener('click', function() {
    document.getElementById('addXtreamModal').classList.remove('active');
});

document.getElementById('addXtreamModalSave').addEventListener('click', function() {
    const url = document.getElementById('add-xtream-url').value;
    const username = document.getElementById('add-xtream-username').value;
    const password = document.getElementById('add-xtream-password').value;
    const expiryDate = document.getElementById('add-xtream-expiry').value;

    if (!url || !username || !password || !expiryDate) {
        notificationSystem.error('Error', 'All fields are required', 3);
        return;
    }

    const result = xtreamManager.addXtream(url, username, password, expiryDate);

    if (result.success) {
        notificationSystem.success('Success', 'Xtream added successfully', 3);
        document.getElementById('addXtreamModal').classList.remove('active');

        document.getElementById('add-xtream-url').value = '';
        document.getElementById('add-xtream-username').value = '';
        document.getElementById('add-xtream-password').value = '';
        document.getElementById('add-xtream-expiry').value = '';

        updateFreeXtreamCards();
    } else {
        notificationSystem.error('Error', result.message, 3);
    }
});

// Edit Xtream Modal
document.getElementById('editXtreamModalClose').addEventListener('click', function() {
    document.getElementById('editXtreamModal').classList.remove('active');
});

document.getElementById('editXtreamModalCancel').addEventListener('click', function() {
    document.getElementById('editXtreamModal').classList.remove('active');
});

document.getElementById('editXtreamModalSave').addEventListener('click', function() {
    const xtreamId = parseInt(document.getElementById('editXtreamModal').dataset.xtreamId);
    const url = document.getElementById('edit-xtream-url').value;
    const username = document.getElementById('edit-xtream-username').value;
    const password = document.getElementById('edit-xtream-password').value;
    const expiryDate = document.getElementById('edit-xtream-expiry').value;

    if (!url || !username || !expiryDate) {
        notificationSystem.error('Error', 'URL, username and expiry date are required', 3);
        return;
    }

    const data = { url, username, expiryDate };
    if (password) {
        data.password = password;
    }

    const result = xtreamManager.editXtream(xtreamId, data);

    if (result.success) {
        notificationSystem.success('Success', 'Xtream updated successfully', 3);
        document.getElementById('editXtreamModal').classList.remove('active');
        updateFreeXtreamCards();
    } else {
        notificationSystem.error('Error', result.message, 3);
    }
});

// Delete Xtream Modal
document.getElementById('deleteXtreamModalClose').addEventListener('click', function() {
    document.getElementById('deleteXtreamModal').classList.remove('active');
});

document.getElementById('deleteXtreamModalCancel').addEventListener('click', function() {
    document.getElementById('deleteXtreamModal').classList.remove('active');
});

document.getElementById('deleteXtreamModalConfirm').addEventListener('click', async function() {
    const xtreamId = parseInt(document.getElementById('deleteXtreamModal').dataset.xtreamId);

    const result = await xtreamManager.deleteXtream(xtreamId);

    if (result.success) {
        notificationSystem.success('Success', 'Xtream deleted successfully', 3);
        document.getElementById('deleteXtreamModal').classList.remove('active');
        updateFreeXtreamCards();
    } else {
        notificationSystem.error('Error', result.message, 3);
    }
});

// ============================================
// MODAL EVENT LISTENERS - IPTV APPS (unchanged)
// ============================================

// Add App Modal
document.getElementById('addAppModalClose').addEventListener('click', function() {
    document.getElementById('addAppModal').classList.remove('active');
});

document.getElementById('addAppModalCancel').addEventListener('click', function() {
    document.getElementById('addAppModal').classList.remove('active');
});

document.getElementById('addAppModalSave').addEventListener('click', function() {
    saveNewApp();
});

// Edit App Modal
document.getElementById('editAppModalClose').addEventListener('click', function() {
    document.getElementById('editAppModal').classList.remove('active');
});

document.getElementById('editAppModalCancel').addEventListener('click', function() {
    document.getElementById('editAppModal').classList.remove('active');
});

document.getElementById('editAppModalSave').addEventListener('click', function() {
    saveEditApp();
});

// Delete App Modal
document.getElementById('deleteAppModalClose').addEventListener('click', function() {
    document.getElementById('deleteAppModal').classList.remove('active');
});

document.getElementById('deleteAppModalCancel').addEventListener('click', function() {
    document.getElementById('deleteAppModal').classList.remove('active');
});

document.getElementById('deleteAppModalConfirm').addEventListener('click', async function() {
    const appId = parseInt(document.getElementById('deleteAppModal').dataset.appId);

    const result = await iptvAppsManager.deleteApp(appId);

    if (result.success) {
        notificationSystem.success('Success', 'IPTV App deleted successfully', 3);
        document.getElementById('deleteAppModal').classList.remove('active');
        updateIPTVAppsCards();
    } else {
        notificationSystem.error('Error', result.message, 3);
    }
});

// ============================================
// MODAL EVENT LISTENERS - TELEGRAM (unchanged)
// ============================================

document.getElementById('editTelegramModalClose').addEventListener('click', function() {
    document.getElementById('editTelegramModal').classList.remove('active');
});

document.getElementById('editTelegramModalCancel').addEventListener('click', function() {
    document.getElementById('editTelegramModal').classList.remove('active');
});

document.getElementById('editTelegramModalSave').addEventListener('click', function() {
    saveTelegramChanges();
});

// ============================================
// TICKET SYSTEM EVENT LISTENERS (unchanged)
// ============================================

newTicketBtn.addEventListener('click', showNewTicketForm);
backToTicketsBtn.addEventListener('click', showTicketsList);
backToTicketsDetailBtn.addEventListener('click', showTicketsList);
backFromEditBtn.addEventListener('click', function() {
    const ticketId = document.getElementById('edit-ticket-id').value;
    if (ticketId) {
        showTicketDetail(parseInt(ticketId));
    } else {
        showTicketsList();
    }
});
cancelNewTicketBtn.addEventListener('click', showTicketsList);

createTicketBtn.addEventListener('click', createNewTicket);
replyBtn.addEventListener('click', addReplyToTicket);

document.getElementById('reply-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.ctrlKey) {
        addReplyToTicket();
    }
});

document.getElementById('edit-ticket-btn').addEventListener('click', function() {
    const ticketId = parseInt(this.dataset.ticketId);
    showEditTicketForm(ticketId);
});

document.getElementById('delete-ticket-btn').addEventListener('click', function() {
    const ticketId = parseInt(this.dataset.ticketId);
    showDeleteConfirm(ticketId);
});

document.getElementById('save-edit-btn').addEventListener('click', saveTicketEdit);
document.getElementById('cancel-edit-btn').addEventListener('click', function() {
    const ticketId = document.getElementById('edit-ticket-id').value;
    if (ticketId) {
        showTicketDetail(parseInt(ticketId));
    } else {
        showTicketsList();
    }
});

document.getElementById('confirm-delete-btn').addEventListener('click', confirmDeleteTicket);
document.getElementById('cancel-delete-btn').addEventListener('click', closeDeleteModal);
document.getElementById('delete-modal-close').addEventListener('click', closeDeleteModal);

deleteModal.addEventListener('click', function(e) {
    if (e.target === this) {
        closeDeleteModal();
    }
});

// ============================================
// CLOSE MODALS ON OUTSIDE CLICK (unchanged)
// ============================================
document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
        }
    });
});

// ============================================
// UPDATE DASHBOARD CARDS
// ============================================
function updateDashboardCards() {
    const user = userManager.currentUser;
    if (!user) return;

    const userManagementCard = document.getElementById('user-management-card');
    const settingsCard = document.getElementById('settings-card');
    const addUserBtn = document.getElementById('add-user-btn');
    const addMacBtn = document.getElementById('add-mac-btn');
    const addXtreamBtn = document.getElementById('add-xtream-btn');
    const addAppBtn = document.getElementById('add-app-btn');

    // User Management Card
    if (userManager.canPerformAction('view_all_users')) {
        userManagementCard.style.display = 'flex';
    } else {
        userManagementCard.style.display = 'none';
    }

    // Settings Card (Owner only)
    if (user.role === 'owner') {
        settingsCard.style.display = 'flex';
    } else {
        settingsCard.style.display = 'none';
    }

    // Add User Button
    if (userManager.canPerformAction('create_user')) {
        addUserBtn.style.display = 'flex';
    } else {
        addUserBtn.style.display = 'none';
    }

    // Add MAC Button
    if (macManager.canUserAddMAC()) {
        addMacBtn.style.display = 'flex';
    } else {
        addMacBtn.style.display = 'none';
    }

    // Add Xtream Button
    if (xtreamManager.canUserAddXtream()) {
        addXtreamBtn.style.display = 'flex';
    } else {
        addXtreamBtn.style.display = 'none';
    }

    // Add App Button
    if (iptvAppsManager.canUserAddApp()) {
        addAppBtn.style.display = 'flex';
    } else {
        addAppBtn.style.display = 'none';
    }
}

// ============================================
// WINDOW LOAD EVENT
// ============================================
window.addEventListener('load', async function() {
    // Wait for userManager to initialize
    while (!userManager.initialized) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (userManager.currentUser) {
        ticketManager.currentUser = userManager.currentUser;

        hideAllSections();
        document.getElementById('dashboard-section').style.display = 'block';
        document.getElementById('header-logout-btn').style.display = 'flex';
        updateDashboardCards();
    }
});

// ============================================
// CARD HOVER EFFECTS (unchanged)
// ============================================
document.querySelectorAll('.dashboard-card').forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-5px)';
    });

    card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
    });
});

// ============================================
// SYSTEM SETTINGS MANAGER (unchanged)
// ============================================
class SystemSettingsManager {
    constructor() {
        this.backupData = null;
        this.encryptionSettings = {
            autoRotate: false,
            lastRotation: null,
            rotationInterval: 30
        };
        this.init();
    }

    init() {
        this.loadSettings();
        this.setupEventListeners();
    }

    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('system_settings');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                this.encryptionSettings = { ...this.encryptionSettings, ...parsed.encryption };
            }
        } catch (e) {
            console.error('Error loading system settings:', e);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('system_settings', JSON.stringify({
                encryption: this.encryptionSettings
            }));
        } catch (e) {
            console.error('Error saving system settings:', e);
        }
    }

    setupEventListeners() {
        const createBackupBtn = document.getElementById('create-backup-btn');
        const restoreBackupBtn = document.getElementById('restore-backup-btn');
        
        if (createBackupBtn) {
            createBackupBtn.addEventListener('click', () => this.createBackup());
        }
        
        if (restoreBackupBtn) {
            restoreBackupBtn.addEventListener('click', () => this.restoreBackup());
        }

        const rotateKeyBtn = document.getElementById('rotate-key-btn');
        const autoRotateToggle = document.getElementById('auto-rotate-toggle');
        
        if (rotateKeyBtn) {
            rotateKeyBtn.addEventListener('click', () => this.rotateEncryptionKey());
        }
        
        if (autoRotateToggle) {
            autoRotateToggle.checked = this.encryptionSettings.autoRotate;
            autoRotateToggle.addEventListener('change', (e) => {
                this.encryptionSettings.autoRotate = e.target.checked;
                this.saveSettings();
                notificationSystem.success(
                    'Settings Updated',
                    `Auto-rotation ${e.target.checked ? 'enabled' : 'disabled'}`,
                    3
                );
            });
        }
    }

    createBackup() {
        try {
            const backup = {
                timestamp: new Date().toISOString(),
                users: securityManager.secureRetrieve(CONFIG.STORAGE_KEYS.USERS) || [],
                macs: securityManager.secureRetrieve(CONFIG.STORAGE_KEYS.FREE_MACS) || [],
                xtreams: securityManager.secureRetrieve(CONFIG.STORAGE_KEYS.FREE_XTREAMS) || [],
                tickets: securityManager.secureRetrieve(CONFIG.STORAGE_KEYS.TICKETS) || [],
                apps: securityManager.secureRetrieve(CONFIG.STORAGE_KEYS.IPTV_APPS) || [],
                telegram: securityManager.secureRetrieve(CONFIG.STORAGE_KEYS.TELEGRAM_LINKS) || {},
                version: '1.0'
            };

            const backupJson = JSON.stringify(backup, null, 2);
            const blob = new Blob([backupJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            securityManager.logSecurityEvent('BACKUP_CREATED', {
                timestamp: backup.timestamp,
                createdBy: userManager.currentUser ? userManager.currentUser.email : 'system'
            });

            notificationSystem.success(
                'Backup Created',
                'System backup downloaded successfully',
                3
            );
        } catch (error) {
            console.error('Backup creation error:', error);
            notificationSystem.error(
                'Backup Failed',
                'Failed to create system backup',
                3
            );
        }
    }

    restoreBackup() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const backup = JSON.parse(event.target.result);
                    
                    if (!backup.users || !backup.version) {
                        throw new Error('Invalid backup file');
                    }

                    if (confirm('This will overwrite all current data. Are you sure?')) {
                        securityManager.secureStore(CONFIG.STORAGE_KEYS.USERS, backup.users);
                        securityManager.secureStore(CONFIG.STORAGE_KEYS.FREE_MACS, backup.macs || []);
                        securityManager.secureStore(CONFIG.STORAGE_KEYS.FREE_XTREAMS, backup.xtreams || []);
                        securityManager.secureStore(CONFIG.STORAGE_KEYS.TICKETS, backup.tickets || []);
                        securityManager.secureStore(CONFIG.STORAGE_KEYS.IPTV_APPS, backup.apps || []);
                        securityManager.secureStore(CONFIG.STORAGE_KEYS.TELEGRAM_LINKS, backup.telegram || {});

                        securityManager.logSecurityEvent('BACKUP_RESTORED', {
                            timestamp: backup.timestamp,
                            restoredBy: userManager.currentUser ? userManager.currentUser.email : 'system'
                        });

                        notificationSystem.success(
                            'Backup Restored',
                            'System data restored successfully. Please refresh the page.',
                            5
                        );

                        setTimeout(() => {
                            location.reload();
                        }, 2000);
                    }
                } catch (error) {
                    console.error('Backup restoration error:', error);
                    notificationSystem.error(
                        'Restore Failed',
                        'Invalid backup file or corrupted data',
                        3
                    );
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }

    async rotateEncryptionKey() {
        try {
            const newKey = await this.generateEncryptionKey();

            localStorage.setItem('iptv_current_encryption_key', newKey);

            this.encryptionSettings.lastRotation = new Date().toISOString();
            this.saveSettings();

            securityManager.logSecurityEvent('ENCRYPTION_KEY_ROTATED', {
                rotatedBy: userManager.currentUser ? userManager.currentUser.email : 'system',
                timestamp: this.encryptionSettings.lastRotation
            });

            notificationSystem.success(
                'Key Rotated',
                'Encryption key rotated successfully',
                3
            );
        } catch (error) {
            console.error('Key rotation error:', error);
            notificationSystem.error(
                'Rotation Failed',
                'Failed to rotate encryption key: ' + error.message,
                3
            );
        }
    }

    async generateEncryptionKey() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    checkAutoRotation() {
        if (!this.encryptionSettings.autoRotate || !this.encryptionSettings.lastRotation) {
            return;
        }

        const lastRotation = new Date(this.encryptionSettings.lastRotation);
        const now = new Date();
        const daysSinceRotation = (now - lastRotation) / (1000 * 60 * 60 * 24);

        if (daysSinceRotation >= this.encryptionSettings.rotationInterval) {
            this.rotateEncryptionKey();
        }
    }

    updateStatistics() {
        const userStats = userManager.getUserStats();
        document.getElementById('stat-total-users').textContent = userStats.total;
        document.getElementById('stat-active-users').textContent = userStats.active;
        document.getElementById('stat-verified-users').textContent = userStats.verified;

        const macResult = macManager.getAllMACs();
        document.getElementById('stat-total-macs').textContent = 
            macResult.success ? macResult.macs.length : 0;

        const xtreamResult = xtreamManager.getAllXtreams();
        document.getElementById('stat-total-xtreams').textContent = 
            xtreamResult.success ? xtreamResult.xtreams.length : 0;

        const appsResult = iptvAppsManager.getAllApps();
        document.getElementById('stat-total-apps').textContent = 
            appsResult.success ? appsResult.apps.length : 0;

        const ticketsResult = ticketManager.getTicketsForUser();
        document.getElementById('stat-total-tickets').textContent = 
            ticketsResult.success ? ticketsResult.tickets.length : 0;
    }
}

const systemSettingsManager = new SystemSettingsManager();

function showSystemSettingsSection() {
    hideAllSections();
    document.getElementById('system-settings-section').style.display = 'block';
    document.getElementById('back-to-dashboard-btn').style.display = 'flex';
    document.getElementById('header-logout-btn').style.display = 'flex';

    systemSettingsManager.updateStatistics();
    systemSettingsManager.checkAutoRotation();
}

document.getElementById('settings-card').addEventListener('click', function() {
    showSystemSettingsSection();
});

// ============================================
// DEBUG INFO
// ============================================
setTimeout(() => {
    console.log('=== SYSTEM DEBUG INFO ===');
    console.log('Users:', userManager.users);
    console.log('Current User:', userManager.currentUser);
    console.log('Next User ID:', userManager.nextUserId);
    console.log('[Firebase] Starting initialization...');
    console.log('========================');
}, 2000);

// ============================================
// PWA - Service Worker (unchanged)
// ============================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('✅ PWA ready:', reg.scope))
      .catch((err) => console.log('❌ PWA error:', err));
  });
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('📱 PWA install available');
});

console.log('✅ AHMEDTECH DZ IPTV System Loaded Successfully - EMAIL AUTHENTICATION VERSION');

// Helper functions for console debugging
window.checkExpiredMACs = async function() {
    console.log('%c[Manual Check] Checking for expired MACs...', 'color: #2196F3; font-weight: bold;');
    if (typeof macManager !== 'undefined') {
        console.log(`[Manual Check] Total MACs: ${macManager.macs.length}`);
        const expired = macManager.macs.filter(mac => macManager.isMACExpired(mac));
        console.log(`[Manual Check] Expired MACs: ${expired.length}`);
        if (expired.length > 0) {
            console.table(expired.map(m => ({ id: m.id, mac: m.macAddress, expiry: m.expiryDate, url: m.url })));
            const removed = await macManager.removeExpiredMACs();
            console.log(`%c[Manual Check] Removed: ${removed} MACs`, 'color: #4CAF50; font-weight: bold;');
        } else {
            console.log('%c[Manual Check] No expired MACs found', 'color: #4CAF50;');
        }
    } else {
        console.error('[Manual Check] macManager not found');
    }
};

window.checkExpiredXtreams = async function() {
    console.log('%c[Manual Check] Checking for expired Xtreams...', 'color: #2196F3; font-weight: bold;');
    if (typeof xtreamManager !== 'undefined') {
        console.log(`[Manual Check] Total Xtreams: ${xtreamManager.xtreams.length}`);
        const expired = xtreamManager.xtreams.filter(x => xtreamManager.isXtreamExpired(x));
        console.log(`[Manual Check] Expired Xtreams: ${expired.length}`);
        if (expired.length > 0) {
            console.table(expired.map(x => ({ id: x.id, username: x.username, expiry: x.expiryDate, url: x.url })));
            const removed = await xtreamManager.removeExpiredXtreams();
            console.log(`%c[Manual Check] Removed: ${removed} Xtreams`, 'color: #4CAF50; font-weight: bold;');
        } else {
            console.log('%c[Manual Check] No expired Xtreams found', 'color: #4CAF50;');
        }
    } else {
        console.error('[Manual Check] xtreamManager not found');
    }
};

window.checkAllExpired = async function() {
    console.log('%c[Manual Check] Running full expiry check...', 'color: #FF9800; font-weight: bold; font-size: 14px;');
    await window.checkExpiredMACs();
    await window.checkExpiredXtreams();
    console.log('%c[Manual Check] Complete!', 'color: #4CAF50; font-weight: bold; font-size: 14px;');
};

window.showAllMACs = function() {
    if (typeof macManager !== 'undefined') {
        console.log('%c[MACManager] All MACs:', 'color: #2196F3; font-weight: bold;');
        console.table(macManager.macs.map(m => ({
            id: m.id,
            macAddress: m.macAddress,
            expiryDate: m.expiryDate,
            isExpired: macManager.isMACExpired(m),
            daysLeft: macManager.getDaysLeft(m.expiryDate)
        })));
    }
};

window.showAllXtreams = function() {
    if (typeof xtreamManager !== 'undefined') {
        console.log('%c[XtreamManager] All Xtreams:', 'color: #2196F3; font-weight: bold;');
        console.table(xtreamManager.xtreams.map(x => ({
            id: x.id,
            username: x.username,
            expiryDate: x.expiryDate,
            isExpired: xtreamManager.isXtreamExpired(x),
            daysLeft: xtreamManager.getDaysLeft(x.expiryDate)
        })));
    }
};

console.log('%c✅ Helper functions loaded!', 'color: #4CAF50; font-weight: bold; font-size: 16px;');
console.log('%cAvailable commands:', 'color: #2196F3; font-weight: bold;');
console.log('  • checkExpiredMACs() - Check and remove expired MACs');
console.log('  • checkExpiredXtreams() - Check and remove expired Xtreams');
console.log('  • checkAllExpired() - Check both MACs and Xtreams');
console.log('  • showAllMACs() - Display all MACs with status');
console.log('  • showAllXtreams() - Display all Xtreams with status');

// ============================================
// CLEANUP HELPER - Run this in Console to fix duplicate owners
// ============================================
window.fixDuplicateOwners = function() {
    console.log('%c[Cleanup] Starting owner cleanup...', 'color: #FF9800; font-size: 14px;');

    const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.USERS);
    if (!saved) {
        console.log('%c[Cleanup] No users found in storage', 'color: #f44336;');
        return;
    }

    try {
        let users = JSON.parse(atob(saved));
        console.log('[Cleanup] Found', users.length, 'users');

        // Find all owners
        const owners = users.filter(u => u.role === 'owner');
        console.log('[Cleanup] Found', owners.length, 'owner(s):');
        owners.forEach(o => console.log('  - ID:', o.id, '| Name:', o.name));

        if (owners.length > 1) {
            // Keep the one with name ID, remove numeric ID
            const nameOwner = owners.find(o => typeof o.id === 'string' && o.id !== '1');
            const numOwner = owners.find(o => o.id === 1 || o.id === '1');

            if (nameOwner && numOwner) {
                console.log('%c[Cleanup] Removing numeric owner (ID: 1)', 'color: #2196F3;');
                users = users.filter(u => !(u.id === 1 || u.id === '1'));

                // Save back
                const encoded = btoa(JSON.stringify(users));
                localStorage.setItem(CONFIG.STORAGE_KEYS.USERS, encoded);

                console.log('%c[Cleanup] Done! Refresh the page.', 'color: #4CAF50; font-size: 16px;');
                return true;
            }
        } else {
            console.log('%c[Cleanup] No duplicates found', 'color: #4CAF50;');
        }
    } catch (e) {
        console.error('[Cleanup] Error:', e);
    }
    return false;
};

console.log('%c[Helper] fixDuplicateOwners() loaded. Run this in console if you see duplicate owners.', 'color: #9C27B0;');
