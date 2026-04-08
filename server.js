const express = require('express');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 2000;

const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'static/images/covers');
const LOGO_DIR = path.join(__dirname, 'static/images/logo');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(LOGO_DIR)) fs.mkdirSync(LOGO_DIR, { recursive: true });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates'));
app.use(express.static(path.join(__dirname, 'static')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-only-fallback-secret-change-in-production',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `film-${Date.now()}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 16 * 1024 * 1024 } });

// ==================== HELPERS ====================

function loadJSON(file, defaultData = {}) {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return defaultData;
    }
}

function saveJSON(file, data) {
    try {
        const filePath = path.join(DATA_DIR, file);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Erreur sauvegarde ${file}:`, error);
        return false;
    }
}

function hashPassword(password) {
    return bcrypt.hashSync(password, 10);
}

function sanitizeFilename(filename) {
    return path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, '_');
}

const CATEGORIES = ['action', 'aventure', 'comédie', 'documentaire', 'drame', 'fantastique', 'horreur', 'comédie musicale', 'mystère', 'romance', 'science-fiction', 'sport', 'thriller', 'western'];

// ==================== CSRF TOKEN ====================

function generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
}

function csrfToken(req, res, next) {
    // Generate token if not exists
    if (!req.session.csrfToken) {
        req.session.csrfToken = generateCSRFToken();
    }
    res.locals.csrfToken = req.session.csrfToken;
    next();
}

function validateCSRF(req, res, next) {
    const token = req.body._csrf || req.query._csrf;
    if (!token || token !== req.session.csrfToken) {
        req.flash('error', 'Token de sécurité invalide');
        return res.redirect('back');
    }
    next();
}

// ==================== FLASH MESSAGES ====================

function flashMiddleware(req, res, next) {
    // Initialize flash storage if needed
    if (!req.session.flash) {
        req.session.flash = [];
    }
    
    // Store current flash messages for this request
    res.locals.flash = req.session.flash;
    
    // Clear flash after making it available to the view
    req.session.flash = [];
    
    // Helper to add flash messages
    req.flash = (type, message) => {
        req.session.flash.push({ type, message });
    };
    
    next();
}

function convertGoogleDriveUrl(url) {
    if (!url || typeof url !== 'string') {
        throw new Error('URL invalide');
    }
    try {
        const parsedUrl = new URL(url);
        const allowedDomains = ['drive.google.com', 'www.youtube.com', 'youtu.be', 'mega.nz', 'mega.co.nz'];
        if (!allowedDomains.includes(parsedUrl.hostname.replace('www.', ''))) {
            throw new Error('Domaine non autorisé');
        }
        return url;
    } catch {
        throw new Error('Format URL invalide');
    }
}

function isAdmin(req) {
    return req.session.user && req.session.user.role === 'admin';
}

function ensureAdmin(req, res, next) {
    if (!isAdmin(req)) {
        req.flash('error', 'Accès refusé');
        return res.redirect('/');
    }
    next();
}

// Apply middlewares
app.use(flashMiddleware);
app.use(csrfToken);

// Global variables for all EJS templates
app.use((req, res, next) => {
    res.locals.session = req.session;
    res.locals.categories = CATEGORIES;
    res.locals.siteSettings = loadJSON('datasite.json', {
        name: 'Streaming',
        logo: '',
        logoUrl: '',
        primaryColor: '#0d6efd',
        secondaryColor: '#212529',
        footerText: '&copy; 2026 Streaming. Tous droits réservés.'
    });
    next();
});

// ==================== ROUTES ====================

app.get('/', (req, res) => {
    const data = loadJSON('films.json', { films: [] });
    const films = data.films.sort((a, b) => new Date(b.date_added) - new Date(a.date_added));
    res.render('index', { films, search_query: '', currentCategory: '' });
});

app.get('/category/:category', (req, res) => {
    const category = req.params.category;
    const data = loadJSON('films.json', { films: [] });
    let films = data.films.filter(f => f.categorie === category);
    films = films.sort((a, b) => new Date(b.date_added) - new Date(a.date_added));
    res.render('index', { films, search_query: '', currentCategory: category });
});

app.get('/search', (req, res) => {
    const query = (req.query.q || '').toLowerCase();
    const data = loadJSON('films.json', { films: [] });
    let films = data.films;
    if (query) {
        films = films.filter(f => 
            f.titre.toLowerCase().includes(query) || 
            f.description.toLowerCase().includes(query)
        );
    }
    res.render('index', { films, search_query: req.query.q || '', currentCategory: '' });
});

// API pour autocomplétion de recherche
app.get('/api/search', (req, res) => {
    const query = (req.query.q || '').toLowerCase().trim();
    if (!query || query.length < 1) {
        return res.json([]);
    }
    
    const data = loadJSON('films.json', { films: [] });
    const films = data.films
        .filter(f => f.titre.toLowerCase().startsWith(query))
        .slice(0, 8)
        .map(f => ({
            id: f.id,
            titre: f.titre,
            cover: f.cover,
            categorie: f.categorie
        }));
    
    res.json(films);
});

app.get('/film/:id', (req, res) => {
    const data = loadJSON('films.json', { films: [] });
    const film = data.films.find(f => f.id === parseInt(req.params.id));
    if (!film) return res.redirect('/');
    res.render('film', { film });
});

app.get('/film/:id/pub2', (req, res) => {
    const data = loadJSON('films.json', { films: [] });
    const film = data.films.find(f => f.id === parseInt(req.params.id));
    if (!film) return res.redirect('/');
    res.render('film2', { film });
});

app.get('/film/:id/player', (req, res) => {
    const data = loadJSON('films.json', { films: [] });
    const film = data.films.find(f => f.id === parseInt(req.params.id));
    if (!film) return res.redirect('/');
    res.render('player', { film });
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            req.flash('error', 'Username et mot de passe requis');
            return res.render('login');
        }
        
        const users = loadJSON('users.json', { users: [] });
        const user = users.users.find(u => u.username === username);
        
        if (user && bcrypt.compareSync(password, user.password)) {
            req.session.user = user;
            req.flash('success', 'Connexion réussie');
            return res.redirect('/admin');
        }
        req.flash('error', 'Identifiants incorrects');
        res.render('login');
    } catch (error) {
        console.error('Erreur login:', error);
        req.flash('error', 'Erreur lors de la connexion');
        res.render('login');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/admin', ensureAdmin, (req, res) => {
    const data = loadJSON('films.json', { films: [] });
    const films = data.films.sort((a, b) => new Date(b.date_added) - new Date(a.date_added));
    res.render('admin', { films });
});

app.get('/admin/add', ensureAdmin, (req, res) => {
    res.render('add_film');
});

// POST route for adding film - multer must run BEFORE validateCSRF
app.post('/admin/add', ensureAdmin, upload.single('cover'), validateCSRF, (req, res) => {
    try {
        const { titre, description, video_url, categorie } = req.body;
        if (!titre || !video_url || !categorie) {
            req.flash('error', 'Titre, URL vidéo et catégorie requis');
            return res.redirect('/admin/add');
        }
        
        const data = loadJSON('films.json', { films: [] });
        const newId = data.films.length > 0 ? Math.max(...data.films.map(f => f.id)) + 1 : 1;
        
        let coverUrl = '/images/covers/default.jpg';
        if (req.file) {
            coverUrl = `/images/covers/${sanitizeFilename(req.file.filename)}`;
        }
        
        const newFilm = {
            id: newId,
            titre,
            categorie,
            description: description || '',
            video_url: convertGoogleDriveUrl(video_url),
            cover: coverUrl,
            date_added: new Date().toISOString().split('T')[0]
        };
        
        data.films.push(newFilm);
        saveJSON('films.json', data);
        
        req.flash('success', 'Film ajouté');
        res.redirect('/admin');
    } catch (error) {
        req.flash('error', error.message || 'Erreur lors de l\'ajout');
        res.redirect('/admin/add');
    }
});

app.get('/admin/edit/:id', ensureAdmin, (req, res) => {
    const data = loadJSON('films.json', { films: [] });
    const film = data.films.find(f => f.id === parseInt(req.params.id));
    if (!film) {
        req.flash('error', 'Film non trouvé');
        return res.redirect('/admin');
    }
    res.render('edit_film', { film });
});

app.post('/admin/edit/:id', ensureAdmin, upload.single('cover'), validateCSRF, (req, res) => {
    try {
        const { titre, description, video_url, categorie } = req.body;
        const data = loadJSON('films.json', { films: [] });
        const filmIndex = data.films.findIndex(f => f.id === parseInt(req.params.id));
        
        if (filmIndex === -1 || !titre || !video_url || !categorie) {
            req.flash('error', 'Titre, URL vidéo et catégorie requis');
            return res.redirect('/admin');
        }
        
        const film = data.films[filmIndex];
        film.titre = titre;
        film.categorie = categorie;
        film.description = description || '';
        film.video_url = convertGoogleDriveUrl(video_url);
        
        if (req.file) {
            film.cover = `/images/covers/${sanitizeFilename(req.file.filename)}`;
        }
        
        saveJSON('films.json', data);
        req.flash('success', 'Film modifié');
        res.redirect('/admin');
    } catch (error) {
        req.flash('error', error.message || 'Erreur lors de la modification');
        res.redirect('/admin');
    }
});

// POST method for delete (more secure than GET)
app.post('/admin/delete/:id', ensureAdmin, validateCSRF, (req, res) => {
    const data = loadJSON('films.json', { films: [] });
    const filmExists = data.films.some(f => f.id === parseInt(req.params.id));
    
    if (!filmExists) {
        req.flash('error', 'Film non trouvé');
        return res.redirect('/admin');
    }
    
    data.films = data.films.filter(f => f.id !== parseInt(req.params.id));
    saveJSON('films.json', data);
    req.flash('success', 'Film supprimé');
    res.redirect('/admin');
});

// Also allow DELETE method for RESTful API
app.delete('/admin/delete/:id', ensureAdmin, (req, res) => {
    const data = loadJSON('films.json', { films: [] });
    const filmExists = data.films.some(f => f.id === parseInt(req.params.id));
    
    if (!filmExists) {
        return res.status(404).json({ error: 'Film non trouvé' });
    }
    
    data.films = data.films.filter(f => f.id !== parseInt(req.params.id));
    saveJSON('films.json', data);
    res.json({ success: true });
});

// ==================== ADMIN SITE SETTINGS ====================

// Storage config for logo upload
const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, LOGO_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `logo${ext}`);
    }
});
const logoUpload = multer({ 
    storage: logoStorage, 
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|svg|webp/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) {
            cb(null, true);
        } else {
            cb(new Error('Formats acceptés: JPEG, PNG, SVG, WebP'));
        }
    }
});

app.get('/admin/settings', ensureAdmin, (req, res) => {
    const siteSettings = loadJSON('datasite.json', {
        name: 'Streaming',
        logo: '',
        logoUrl: '',
        primaryColor: '#0d6efd',
        secondaryColor: '#212529',
        footerText: '&copy; 2026 Streaming. Tous droits réservés.'
    });
    res.render('settings', { siteSettings });
});

app.post('/admin/settings', ensureAdmin, logoUpload.single('logo'), validateCSRF, (req, res) => {
    try {
        const { name, logoUrl, primaryColor, secondaryColor, footerText } = req.body;
        
        const currentSettings = loadJSON('datasite.json', {});
        
        const newSettings = {
            name: name || 'Streaming',
            logo: req.file ? `/images/logo/${req.file.filename}` : currentSettings.logo || '',
            logoUrl: logoUrl || '',
            primaryColor: primaryColor || '#0d6efd',
            secondaryColor: secondaryColor || '#212529',
            footerText: footerText || '&copy; 2026 Streaming. Tous droits réservés.'
        };
        
        // If logo URL is provided, use it instead of uploaded file
        if (logoUrl && logoUrl.trim()) {
            newSettings.logo = '';
            newSettings.logoUrl = logoUrl;
        }
        
        saveJSON('datasite.json', newSettings);
        
        req.flash('success', 'Paramètres du site enregistrés');
        res.redirect('/admin/settings');
    } catch (error) {
        req.flash('error', error.message || 'Erreur lors de l\'enregistrement');
        res.redirect('/admin/settings');
    }
});


app.use((req, res) => res.status(404).render('404'));

// ==================== INITIALIZATION ====================

const usersData = loadJSON('users.json', { users: [] });
if (!usersData.users.length) {
    const adminUser = {
        id: 1,
        username: 'admin',
        password: hashPassword('admin123'),
        role: 'admin'
    };
    usersData.users = [adminUser];
    saveJSON('users.json', usersData);
    if (process.env.NODE_ENV !== 'production') {
        console.log('Compte admin créé (défaut)');
    }
}

app.listen(PORT, () => {
    console.log(`Serveur: http://localhost:${PORT}`);
    console.log(`Admin: http://localhost:${PORT}/login`);
});
