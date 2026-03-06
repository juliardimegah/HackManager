const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb, queryAll, queryOne, execute } = require('./db');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'hackathon-secret-key-2026',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));
app.use(express.static(path.join(__dirname, 'public')));

// File upload config
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Serve uploaded files
app.use('/uploads', express.static(uploadDir));

// ============== AUTH MIDDLEWARE ==============

function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    return res.status(401).json({ error: 'Akses ditolak. Silakan login sebagai admin.' });
}

// ============== AUTH ROUTES ==============

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const admin = queryOne('SELECT * FROM admin_credentials WHERE id = 1');

    if (admin && admin.username === username && admin.password === password) {
        req.session.isAdmin = true;
        return res.json({ success: true, message: 'Login berhasil!' });
    }
    return res.status(401).json({ error: 'Username atau password salah.' });
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logout berhasil.' });
});

app.get('/api/auth/check', (req, res) => {
    res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// ============== CAPTCHA ==============

function generateCaptcha() {
    const ops = ['+', '-', '×'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a, b, answer;

    switch (op) {
        case '+':
            a = Math.floor(Math.random() * 30) + 5;
            b = Math.floor(Math.random() * 20) + 3;
            answer = a + b;
            break;
        case '-':
            a = Math.floor(Math.random() * 30) + 15;
            b = Math.floor(Math.random() * 14) + 1;
            answer = a - b;
            break;
        case '×':
            a = Math.floor(Math.random() * 9) + 2;
            b = Math.floor(Math.random() * 9) + 2;
            answer = a * b;
            break;
    }

    return { expression: `${a} ${op} ${b}`, answer };
}

function generateCaptchaSVG(expression) {
    const width = 200;
    const height = 60;

    // Generate random noise lines
    let noiseLines = '';
    for (let i = 0; i < 8; i++) {
        const x1 = Math.floor(Math.random() * width);
        const y1 = Math.floor(Math.random() * height);
        const x2 = Math.floor(Math.random() * width);
        const y2 = Math.floor(Math.random() * height);
        const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#64748b', '#94a3b8'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        noiseLines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1" opacity="0.4"/>`;
    }

    // Generate random dots
    let dots = '';
    for (let i = 0; i < 30; i++) {
        const cx = Math.floor(Math.random() * width);
        const cy = Math.floor(Math.random() * height);
        const r = Math.random() * 2 + 0.5;
        dots += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#64748b" opacity="0.3"/>`;
    }

    // Render each character with random transforms
    let textElements = '';
    const chars = expression.split('');
    const startX = 30;
    const spacing = 20;

    chars.forEach((char, i) => {
        const x = startX + i * spacing;
        const y = 38 + (Math.random() * 10 - 5);
        const rotation = Math.random() * 20 - 10;
        const colors = ['#e2e8f0', '#f1f5f9', '#cbd5e1', '#a78bfa', '#818cf8'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const fontSize = 22 + Math.floor(Math.random() * 6);
        textElements += `<text x="${x}" y="${y}" fill="${color}" font-family="monospace" font-size="${fontSize}" font-weight="bold" transform="rotate(${rotation} ${x} ${y})">${char}</text>`;
    });

    // Add " = ?" at the end
    const eqX = startX + chars.length * spacing + 5;
    textElements += `<text x="${eqX}" y="38" fill="#94a3b8" font-family="monospace" font-size="22" font-weight="bold">= ?</text>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#111827" rx="8"/>
    ${noiseLines}
    ${dots}
    ${textElements}
  </svg>`;
}

app.get('/api/captcha', (req, res) => {
    const captcha = generateCaptcha();
    req.session.captchaAnswer = captcha.answer;
    const svg = generateCaptchaSVG(captcha.expression);
    res.type('image/svg+xml').send(svg);
});

// ============== HACKATHON SETTINGS ==============

app.get('/api/hackathon', (req, res) => {
    const settings = queryOne('SELECT * FROM hackathon_settings WHERE id = 1');
    res.json(settings);
});

app.put('/api/hackathon', requireAdmin, (req, res) => {
    const { name, end_time } = req.body;
    execute('UPDATE hackathon_settings SET name = ?, end_time = ? WHERE id = 1', [name, end_time]);
    const updated = queryOne('SELECT * FROM hackathon_settings WHERE id = 1');
    res.json(updated);
});

// ============== SUBMISSIONS ==============

app.get('/api/submissions', (req, res) => {
    const { sort = 'submitted_at', order = 'desc', search = '' } = req.query;

    const allowedSorts = ['submitted_at', 'team_name', 'project_title', 'status'];
    const sortCol = allowedSorts.includes(sort) ? sort : 'submitted_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    let query = 'SELECT * FROM submissions';
    const params = [];

    if (search) {
        query += ' WHERE team_name LIKE ? OR project_title LIKE ?';
        params.push('%' + search + '%', '%' + search + '%');
    }

    query += ` ORDER BY ${sortCol} ${sortOrder}`;

    const submissions = queryAll(query, params);
    res.json(submissions);
});

app.post('/api/submissions', upload.single('file'), (req, res) => {
    const { team_name, members, project_title, description, demo_link, captcha_answer } = req.body;

    if (!team_name || !members || !project_title) {
        return res.status(400).json({ error: 'Nama tim, anggota, dan judul proyek wajib diisi.' });
    }

    // Validate captcha (skip for admin)
    if (!(req.session && req.session.isAdmin)) {
        if (!captcha_answer || parseInt(captcha_answer) !== req.session.captchaAnswer) {
            return res.status(400).json({ error: 'Jawaban captcha salah. Silakan coba lagi.' });
        }
        // Clear used captcha
        delete req.session.captchaAnswer;
    }

    const file_path = req.file ? '/uploads/' + req.file.filename : null;

    const result = execute(
        'INSERT INTO submissions (team_name, members, project_title, description, demo_link, file_path) VALUES (?, ?, ?, ?, ?, ?)',
        [team_name, members, project_title, description || '', demo_link || '', file_path]
    );

    const submission = queryOne('SELECT * FROM submissions WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(submission);
});

app.patch('/api/submissions/:id/status', requireAdmin, (req, res) => {
    const { status } = req.body;
    const validStatuses = ['pending', 'reviewed', 'presented'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Status tidak valid.' });
    }
    execute('UPDATE submissions SET status = ? WHERE id = ?', [status, parseInt(req.params.id)]);
    const updated = queryOne('SELECT * FROM submissions WHERE id = ?', [parseInt(req.params.id)]);
    if (!updated) return res.status(404).json({ error: 'Submission tidak ditemukan.' });
    res.json(updated);
});

app.delete('/api/submissions/:id', requireAdmin, (req, res) => {
    const submission = queryOne('SELECT * FROM submissions WHERE id = ?', [parseInt(req.params.id)]);
    if (!submission) return res.status(404).json({ error: 'Submission tidak ditemukan.' });

    if (submission.file_path) {
        const filePath = path.join(__dirname, submission.file_path);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    execute('DELETE FROM submissions WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ message: 'Submission berhasil dihapus.' });
});

// ============== RANDOMIZER ==============

app.get('/api/randomizer/history', (req, res) => {
    const history = queryAll(
        `SELECT rh.id, rh.picked_at, s.team_name, s.project_title
     FROM randomizer_history rh
     JOIN submissions s ON rh.submission_id = s.id
     ORDER BY rh.picked_at DESC
     LIMIT 50`
    );
    res.json(history);
});

app.delete('/api/randomizer/history', requireAdmin, (req, res) => {
    execute('DELETE FROM randomizer_history');
    res.json({ message: 'Riwayat pemilihan berhasil dihapus.' });
});

app.post('/api/randomizer/pick', requireAdmin, (req, res) => {
    const submissions = queryAll("SELECT * FROM submissions WHERE status != 'presented'");

    if (submissions.length === 0) {
        return res.status(400).json({ error: 'Tidak ada submission yang tersedia untuk dipilih.' });
    }

    const picked = submissions[Math.floor(Math.random() * submissions.length)];
    execute("UPDATE submissions SET status = 'presented' WHERE id = ?", [picked.id]);
    execute('INSERT INTO randomizer_history (submission_id) VALUES (?)', [picked.id]);

    res.json({
        allSubmissions: submissions.map(s => ({ id: s.id, team_name: s.team_name, project_title: s.project_title })),
        picked: { ...picked, status: 'presented' }
    });
});

// ============== PAGE ROUTES ==============

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server after DB init
async function start() {
    await getDb();
    app.listen(PORT, () => {
        console.log(`🚀 Hackathon Manager running at http://localhost:${PORT}`);
        console.log(`   Peserta: http://localhost:${PORT}/`);
        console.log(`   Admin:   http://localhost:${PORT}/admin`);
    });
}

start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
