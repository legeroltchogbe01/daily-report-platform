const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { Pool } = require('pg');

// Load .env if present (tiny custom parser to avoid pulling dotenv for one var)
const ENV_FILE = path.join(__dirname, '.env');
try {
  if (fs.existsSync(ENV_FILE)) {
    const raw = fs.readFileSync(ENV_FILE, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
} catch (e) { console.warn('Could not read .env:', e.message); }


const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const useDb = !!process.env.DATABASE_URL;
const pool = useDb ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;

const loadJson = (filePath, defaultValue) => {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (err) {
    console.error(`Erreur lecture ${filePath}:`, err);
    return defaultValue;
  }
};

const saveJson = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

const hashPassword = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex');
};

let isUsersInitialized = false;

const generateMatricule = () => {
  let mat = 'EMP-' + Math.floor(10000 + Math.random() * 90000);
  if (!useDb && isUsersInitialized) {
    let exists = true;
    while (exists) {
      mat = 'EMP-' + Math.floor(10000 + Math.random() * 90000);
      exists = (users || []).some(u => u.matricule === mat);
    }
  }
  return mat;
};

const createUser = (username, password, role) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const matricule = role === 'employee' ? generateMatricule() : null;
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    username,
    salt,
    hash: hashPassword(password, salt),
    role,
    matricule
  };
};

const verifyPassword = (password, user) => {
  if (!user || !user.salt || !user.hash) return false;
  return hashPassword(password, user.salt) === user.hash;
};

const normalizeUsername = username => (username || '').trim().toLowerCase();

const queryDb = async (text, params) => {
  if (!pool) throw new Error('No database configured');
  return pool.query(text, params);
};

const initDb = async () => {
  if (!useDb) return;

  await queryDb(`CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    salt TEXT NOT NULL,
    hash TEXT NOT NULL,
    role TEXT NOT NULL
  )`);

  // Schema migration: add matricule column
  await queryDb(`ALTER TABLE users ADD COLUMN IF NOT EXISTS matricule TEXT UNIQUE`);

  await queryDb(`CREATE TABLE IF NOT EXISTS reports (
    id BIGSERIAL PRIMARY KEY,
    employee TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ,
    attachment JSONB
  )`);

  await queryDb(`CREATE TABLE IF NOT EXISTS comments (
    id BIGSERIAL PRIMARY KEY,
    report_id BIGINT REFERENCES reports(id) ON DELETE CASCADE,
    author TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
  )`);

  await queryDb(`CREATE TABLE IF NOT EXISTS projects (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    manager TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    cahier_updated_at TIMESTAMPTZ NOT NULL,
    assigned_employees JSONB NOT NULL,
    status_by_employee JSONB NOT NULL,
    submissions JSONB NOT NULL,
    messages JSONB NOT NULL,
    files JSONB NOT NULL,
    archived BOOLEAN NOT NULL DEFAULT FALSE
  )`);

  // Seeding
  const count = await queryDb('SELECT COUNT(*) FROM users');
  if (Number(count.rows[0].count) === 0) {
    const seedUsers = [
      { username: 'employee1', password: '1234', role: 'employee' },
      { username: 'employee2', password: '1234', role: 'employee' },
      { username: 'boss', password: '1234', role: 'boss' }
    ];
    for (const user of seedUsers) {
      const newUser = createUser(user.username, user.password, user.role);
      await queryDb('INSERT INTO users (username, salt, hash, role, matricule) VALUES ($1,$2,$3,$4,$5)', [newUser.username, newUser.salt, newUser.hash, newUser.role, newUser.matricule]);
    }
  }

  // Data migration: assign matricules to existing employees
  const noMatriculeUsers = await queryDb("SELECT id, username FROM users WHERE role = 'employee' AND matricule IS NULL");
  for (const r of noMatriculeUsers.rows) {
    const mat = generateMatricule();
    await queryDb("UPDATE users SET matricule = $1 WHERE id = $2", [mat, r.id]);
  }
};

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use((req, res, next) => {
  console.log(`[request] ${req.method} ${req.url}`);
  const originalJson = res.json;
  res.json = function(body) {
    console.log(`[response] ${req.method} ${req.url} -> status ${res.statusCode}:`, JSON.stringify(body).slice(0, 150));
    return originalJson.apply(this, arguments);
  };
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(session({
  secret: 'daily-report-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

const defaultUsers = [
  createUser('employee1', '1234', 'employee'),
  createUser('employee2', '1234', 'employee'),
  createUser('boss', '1234', 'boss')
];

const users = loadJson(USERS_FILE, defaultUsers);
isUsersInitialized = true;

// Migration for local JSON users
let usersMigrated = false;
users.forEach(u => {
  if (u.role === 'employee' && !u.matricule) {
    u.matricule = generateMatricule();
    usersMigrated = true;
  }
});
if (usersMigrated) {
  saveJson(USERS_FILE, users);
}
const reports = loadJson(REPORTS_FILE, []);
const comments = loadJson(COMMENTS_FILE, []);
const projects = loadJson(PROJECTS_FILE, []);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  }
});

const ALLOWED_MIMES = new Set([
  // documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/rtf',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/json',
  'application/xml',
  'text/plain',
  'text/csv',
  'text/html',
  'text/xml',
  // images
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  // audio
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  // video
  'video/mp4',
  'video/webm',
  'video/quicktime'
]);

const ALLOWED_EXTS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.rtf', '.txt', '.csv', '.json', '.xml', '.html',
  '.zip', '.rar',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp',
  '.mp3', '.wav', '.ogg', '.m4a',
  '.mp4', '.webm', '.mov'
]);

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB per file
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIMES.has(file.mimetype) || ALLOWED_EXTS.has(ext)) {
      return cb(null, true);
    }
    cb(new Error(`Type de fichier non autorisé: ${file.mimetype || 'inconnu'} (${ext})`));
  }
});

// Cloud-ready file storage abstraction.
// Local (default): multer disk saves under uploads/, served via /uploads/.
// Cloud: when STORAGE_PROVIDER=cloudinary AND CLOUDINARY_URL is set, upload via SDK.
// Falls back to local if the SDK is missing.
const STORAGE_PROVIDER = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
const CLOUDINARY_URL = process.env.CLOUDINARY_URL;
let CLOUDINARY_CONFIGURED = false;
let _cloudinary = null;
if (STORAGE_PROVIDER === 'cloudinary' && CLOUDINARY_URL) {
  try {
    _cloudinary = require('cloudinary').v2;
    _cloudinary.config({ secure: true });
    CLOUDINARY_CONFIGURED = true;
    // eslint-disable-next-line no-console
    console.log('[storage] Cloudinary activé.');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[storage] Cloudinary demandé mais SDK absent — fallback sur disque local.');
  }
}

const _storeFileFromLocal = (file) => ({
  filename: file.filename,
  originalName: file.originalname,
  mimeType: file.mimetype,
  size: file.size,
  url: `/uploads/${file.filename}`
});

const _storeFileFromCloud = (file) => new Promise((resolve, reject) => {
  const folder = `daily-report-platform/${(file.fieldname || 'files').replace(/[^a-z0-9_-]/gi, '_')}`;
  const stream = _cloudinary.uploader.upload_stream(
    { folder, resource_type: 'auto', use_filename: true, unique_filename: true },
    (err, result) => {
      // Best-effort cleanup of temp local file on disk
      try { fs.unlinkSync(file.path); } catch (_) {}
      if (err) return reject(err);
      resolve({
        filename: result.public_id,
        originalName: file.originalname,
        mimeType: file.mimetype || result.resource_type,
        size: file.size,
        url: result.secure_url,
        provider: 'cloudinary'
      });
    }
  );
  // multer disk file → stream
  fs.createReadStream(file.path).pipe(stream);
});

const storeFile = async (file) => {
  if (!file) return null;
  if (CLOUDINARY_CONFIGURED) return _storeFileFromCloud(file);
  return _storeFileFromLocal(file);
};

const REPORT_EDIT_WINDOW_MS = 10 * 60 * 1000;

const saveProjects = () => saveJson(PROJECTS_FILE, projects);

const getProjectWithExtras = project => ({
  ...project,
  assignedEmployees:  project.assignedEmployees  || project.assigned_employees   || [],
  statusByEmployee:   project.statusByEmployee   || project.status_by_employee   || {},
  submissions:        project.submissions        || [],
  messages:           project.messages           || [],
  files:              project.files              || []
});

const isReportEditable = (report, user) => {
  if (!user || user.role !== 'employee') return false;
  if (report.employee !== user.username) return false;
  const createdAt = new Date(report.createdAt || report.created_at).getTime();
  return Date.now() - createdAt <= REPORT_EDIT_WINDOW_MS;
};

const fetchUser = async username => {
  if (useDb) {
    const result = await queryDb('SELECT * FROM users WHERE lower(username) = lower($1)', [normalizeUsername(username)]);
    return result.rows[0];
  }
  return users.find(u => u.username.toLowerCase() === normalizeUsername(username));
};

const fetchUsernameByMatricule = async matricule => {
  const cleanMat = (matricule || '').trim().toUpperCase();
  if (useDb) {
    const result = await queryDb('SELECT username FROM users WHERE UPPER(matricule) = $1 AND role = $2', [cleanMat, 'employee']);
    return result.rows[0] ? result.rows[0].username : null;
  }
  const user = users.find(u => u.role === 'employee' && (u.matricule || '').trim().toUpperCase() === cleanMat);
  return user ? user.username : null;
};

const insertUser = async (username, password, role) => {
  if (useDb) {
    const newUser = createUser(username, password, role);
    await queryDb('INSERT INTO users (username, salt, hash, role, matricule) VALUES ($1,$2,$3,$4,$5)', [newUser.username, newUser.salt, newUser.hash, newUser.role, newUser.matricule]);
    return newUser;
  }
  const user = createUser(username, password, role);
  users.push(user);
  saveJson(USERS_FILE, users);
  return user;
};

const getEmployeeUsers = async (bossUsername = null) => {
  if (bossUsername) {
    if (useDb) {
      const sql = `
        SELECT DISTINCT u.id, u.username, u.matricule 
        FROM users u
        JOIN projects p ON u.username = ANY(p.assigned_employees)
        WHERE u.role = 'employee' AND p.manager = $1
        ORDER BY u.username
      `;
      const result = await queryDb(sql, [bossUsername]);
      return result.rows;
    }
    const bossProjects = (projects || []).filter(p => p.manager === bossUsername);
    const assignedUsernames = new Set();
    bossProjects.forEach(p => {
      (p.assigned_employees || p.assignedEmployees || []).forEach(emp => assignedUsernames.add(emp));
    });
    return (users || [])
      .filter(u => u.role === 'employee' && assignedUsernames.has(u.username))
      .map(u => ({ id: u.id, username: u.username, matricule: u.matricule }));
  }

  if (useDb) {
    const result = await queryDb('SELECT id, username, matricule FROM users WHERE role = $1 ORDER BY username', ['employee']);
    return result.rows;
  }
  return (users || []).filter(u => u.role === 'employee').map(u => ({ id: u.id, username: u.username, matricule: u.matricule }));
};

const getProjectById = async id => {
  if (useDb) {
    const result = await queryDb('SELECT * FROM projects WHERE id = $1', [id]);
    return result.rows[0];
  }
  return projects.find(p => p.id === id);
};

const createProject = async (name, description, manager, assignees) => {
  if (useDb) {
    const statuses = assignees.reduce((acc, username) => ({ ...acc, [username]: 'assigned' }), {});
    const project = {
      name,
      description,
      manager,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      cahier_updated_at: new Date().toISOString(),
      assigned_employees: assignees,
      status_by_employee: statuses,
      submissions: [],
      messages: [],
      files: [],
      archived: false
    };
    const result = await queryDb(
      'INSERT INTO projects (name, description, manager, created_at, updated_at, cahier_updated_at, assigned_employees, status_by_employee, submissions, messages, files, archived) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',
      [project.name, project.description, project.manager, project.created_at, project.updated_at, project.cahier_updated_at, JSON.stringify(project.assigned_employees), JSON.stringify(project.status_by_employee), JSON.stringify(project.submissions), JSON.stringify(project.messages), JSON.stringify(project.files), project.archived]
    );
    return result.rows[0];
  }
  const project = {
    id: Date.now(),
    name,
    description,
    manager,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cahierUpdatedAt: new Date().toISOString(),
    assignedEmployees: assignees,
    statusByEmployee: assignees.reduce((acc, username) => ({ ...acc, [username]: 'assigned' }), {}),
    submissions: [],
    messages: [],
    files: [],
    archived: false
  };
  projects.push(project);
  saveProjects();
  return project;
};

const updateProject = async (id, name, description) => {
  if (useDb) {
    const result = await queryDb(
      'UPDATE projects SET name = $1, description = $2, updated_at = $3, cahier_updated_at = $3 WHERE id = $4 RETURNING *',
      [name, description, new Date().toISOString(), id]
    );
    return result.rows[0];
  }
  const project = projects.find(p => p.id === id);
  if (!project) return null;
  project.name = name;
  project.description = description;
  project.updatedAt = new Date().toISOString();
  project.cahierUpdatedAt = new Date().toISOString();
  saveProjects();
  return project;
};

const saveProject = async project => {
  if (useDb) {
    await queryDb(
      'UPDATE projects SET name = $1, description = $2, updated_at = $3, cahier_updated_at = $4, assigned_employees = $5, status_by_employee = $6, submissions = $7, messages = $8, files = $9, archived = $10 WHERE id = $11',
      [project.name, project.description, project.updated_at || project.updatedAt, project.cahier_updated_at || project.cahierUpdatedAt, JSON.stringify(project.assigned_employees || project.assignedEmployees), JSON.stringify(project.status_by_employee || project.statusByEmployee), JSON.stringify(project.submissions || []), JSON.stringify(project.messages || []), JSON.stringify(project.files || []), project.archived, project.id]
    );
    return project;
  }
  const index = projects.findIndex(p => p.id === project.id);
  if (index >= 0) {
    projects[index] = project;
    saveProjects();
  }
  return project;
};

const getProjectsForUser = async user => {
  if (useDb) {
    if (user.role === 'boss') {
      const result = await queryDb('SELECT * FROM projects WHERE manager = $1 AND archived = false ORDER BY created_at DESC', [user.username]);
      return result.rows;
    }
    const result = await queryDb('SELECT * FROM projects WHERE archived = false AND assigned_employees @> $1::jsonb ORDER BY created_at DESC', [JSON.stringify([user.username])]);
    return result.rows;
  }
  return user.role === 'boss'
    ? projects.filter(p => p.manager === user.username && !p.archived)
    : projects.filter(p => p.assignedEmployees.includes(user.username) && !p.archived);
};

const getProjectsArchiveForUser = async user => {
  if (useDb) {
    if (user.role === 'boss') {
      const result = await queryDb('SELECT * FROM projects WHERE manager = $1 AND archived = true ORDER BY created_at DESC', [user.username]);
      return result.rows;
    }
    const result = await queryDb('SELECT * FROM projects WHERE archived = true AND assigned_employees @> $1::jsonb ORDER BY created_at DESC', [JSON.stringify([user.username])]);
    return result.rows;
  }
  return user.role === 'boss'
    ? projects.filter(p => p.manager === user.username && p.archived)
    : projects.filter(p => p.assignedEmployees.includes(user.username) && p.archived);
};

const createReport = async (employee, title, content, attachment) => {
  if (useDb) {
    const result = await queryDb(
      'INSERT INTO reports (employee, title, content, date, created_at, attachment) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [employee, title, content, new Date().toISOString().slice(0, 10), new Date().toISOString(), attachment ? JSON.stringify(attachment) : null]
    );
    return result.rows[0];
  }
  const report = {
    id: Date.now(),
    employee,
    title,
    content,
    date: new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    attachment
  };
  reports.push(report);
  saveJson(REPORTS_FILE, reports);
  return report;
};

const getReportsForUser = async user => {
  if (useDb) {
    if (user.role === 'boss') {
      const result = await queryDb('SELECT * FROM reports ORDER BY created_at DESC');
      return result.rows;
    }
    const result = await queryDb('SELECT * FROM reports WHERE employee = $1 ORDER BY created_at DESC', [user.username]);
    return result.rows;
  }
  return user.role === 'boss' ? reports : reports.filter(r => r.employee === user.username);
};

const getReportById = async id => {
  if (useDb) {
    const result = await queryDb('SELECT * FROM reports WHERE id = $1', [id]);
    return result.rows[0];
  }
  return reports.find(r => r.id === id);
};

const updateReport = async (id, title, content) => {
  if (useDb) {
    const result = await queryDb('UPDATE reports SET title = $1, content = $2, updated_at = $3 WHERE id = $4 RETURNING *', [title, content, new Date().toISOString(), id]);
    return result.rows[0];
  }
  const report = reports.find(r => r.id === id);
  if (!report) return null;
  report.title = title;
  report.content = content;
  report.updatedAt = new Date().toISOString();
  saveJson(REPORTS_FILE, reports);
  return report;
};

const getCommentsForReport = async reportId => {
  if (useDb) {
    const result = await queryDb('SELECT * FROM comments WHERE report_id = $1 ORDER BY created_at ASC', [reportId]);
    return result.rows;
  }
  return comments.filter(c => c.reportId === reportId);
};

const createComment = async (reportId, author, text) => {
  if (useDb) {
    const result = await queryDb('INSERT INTO comments (report_id, author, text, created_at) VALUES ($1,$2,$3,$4) RETURNING *', [reportId, author, text, new Date().toISOString()]);
    return result.rows[0];
  }
  const comment = {
    id: Date.now(),
    reportId,
    author,
    text,
    createdAt: new Date().toISOString()
  };
  comments.push(comment);
  saveJson(COMMENTS_FILE, comments);
  return comment;
};

const createProjectSubmission = async (project, employee, submissionType, text, attachment) => {
  const submission = {
    id: Date.now(),
    projectId: project.id,
    employee,
    type: submissionType,
    text,
    attachment,
    createdAt: new Date().toISOString()
  };
  if (useDb) {
    project.submissions = project.submissions || [];
    project.submissions.push(submission);
    await saveProject(project);
    return submission;
  }
  project.submissions.push(submission);
  saveJson(PROJECTS_FILE, projects);
  return submission;
};

const addProjectMessage = async (project, author, text, attachments = [], replyTo = null) => {
  const atts = Array.isArray(attachments) ? attachments : (attachments ? [attachments] : []);
  const message = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    author,
    text,
    attachments: atts,
    replyTo,
    createdAt: new Date().toISOString()
  };
  if (useDb) {
    project.messages = project.messages || [];
    project.messages.push(message);
    await saveProject(project);
    return message;
  }
  project.messages.push(message);
  saveJson(PROJECTS_FILE, projects);
  return message;
};

const acceptProject = async (project, employee) => {
  if (useDb) {
    project.status_by_employee = project.status_by_employee || project.statusByEmployee || {};
    project.status_by_employee[employee] = 'accepted';
    await saveProject(project);
    return project;
  }
  project.statusByEmployee[employee] = 'accepted';
  saveJson(PROJECTS_FILE, projects);
  return project;
};

const archiveProject = async project => {
  project.archived = true;
  if (useDb) {
    await saveProject(project);
    return project;
  }
  saveJson(PROJECTS_FILE, projects);
  return project;
};

const removeProject = async project => {
  // Best-effort cleanup of uploaded files for the local provider.
  if (!CLOUDINARY_CONFIGURED) {
    const list = project.files || [];
    for (const f of list) {
      if (!f || !f.filename) continue;
      const onDisk = path.join(UPLOAD_DIR, f.filename);
      try { fs.unlinkSync(onDisk); } catch (_) { /* missing or already gone */ }
    }
  }
  if (useDb) {
    await queryDb('DELETE FROM projects WHERE id = $1', [project.id]);
    return true;
  }
  const idx = projects.findIndex(p => p.id === project.id);
  if (idx >= 0) {
    projects.splice(idx, 1);
    saveProjects();
  }
  return true;
};

const ensureProjectAccess = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) {
    res.status(404).json({ error: 'Projet introuvable.' });
    return null;
  }
  const project = await getProjectById(id);
  if (!project) {
    res.status(404).json({ error: 'Projet introuvable.' });
    return null;
  }
  const user = req.session.user;
  if (!user) {
    res.status(401).json({ error: 'Non connecté' });
    return null;
  }
  const assigned = project.assigned_employees || project.assignedEmployees || [];
  if (user.role !== 'boss' && !assigned.includes(user.username)) {
    res.status(403).json({ error: 'Vous n\u2019avez pas acc\u00e8s \u00e0 ce projet.' });
    return null;
  }
  return { project, assigned };
};

app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  if (!req.session.user) return res.sendFile(path.join(__dirname, 'views', 'login.html'));
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const login = normalizeUsername(username);
  const user = await fetchUser(login);
  if (!verifyPassword(password, user)) return res.status(401).json({ error: 'Identifiants invalides' });
  req.session.user = { id: user.id, username: user.username, role: user.role };
  res.json({ success: true, role: user.role });
});

app.post('/register', async (req, res) => {
  const { username, password, role } = req.body;
  const login = normalizeUsername(username);
  if (!login || !password || password.length < 4) {
    return res.status(400).json({ error: 'Nom d’utilisateur et mot de passe (min 4 caractères) requis.' });
  }
  const existing = await fetchUser(login);
  if (existing) {
    return res.status(400).json({ error: 'Ce nom d’utilisateur existe déjà.' });
  }
  const userRole = (role === 'boss') ? 'boss' : 'employee';
  const newUser = await insertUser(login, password, userRole);
  req.session.user = { id: newUser.id, username: newUser.username, role: newUser.role };
  res.json({ success: true, role: newUser.role });
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
  const user = await fetchUser(req.session.user.username);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    matricule: user.matricule
  });
});

app.post('/api/change-password', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'L’ancien et le nouveau mot de passe (min 4 caractères) sont requis.' });
  }
  const user = await fetchUser(req.session.user.username);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  if (!verifyPassword(oldPassword, user)) {
    return res.status(400).json({ error: 'L’ancien mot de passe est incorrect.' });
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(newPassword, salt);
  if (useDb) {
    await queryDb('UPDATE users SET salt = $1, hash = $2 WHERE id = $3', [salt, hash, user.id]);
  } else {
    const memoryUser = users.find(u => u.id === user.id);
    if (memoryUser) {
      memoryUser.salt = salt;
      memoryUser.hash = hash;
      saveJson(USERS_FILE, users);
    }
  }
  res.json({ success: true });
});

app.get('/api/users', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'boss') return res.status(403).json({ error: 'Accès refusé' });
  const usersList = await getEmployeeUsers(req.session.user.username);
  res.json(usersList);
});

app.post('/api/reports', upload.single('attachment'), async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'employee') {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const title = (req.body.title || '').trim();
  const content = (req.body.content || '').trim();
  if (!title || !content) {
    return res.status(400).json({ error: 'Le titre et le contenu sont requis.' });
  }
  let attachment = null;
  if (req.file) {
    try {
      attachment = await storeFile(req.file);
    } catch (err) {
      console.error('Error uploading report file to storage:', err);
      return res.status(500).json({ error: 'Erreur lors de l’enregistrement du fichier joint.' });
    }
  }
  const report = await createReport(req.session.user.username, title, content, attachment);
  res.json(report);
});

app.get('/api/reports', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
  const visibleReports = await getReportsForUser(req.session.user);
  const enrichedReports = visibleReports.map(report => {
    const payload = { ...report };
    if (req.session.user.role === 'employee') {
      payload.canEdit = isReportEditable(payload, req.session.user);
      payload.editableUntil = new Date(new Date(payload.createdAt || payload.created_at).getTime() + REPORT_EDIT_WINDOW_MS).toISOString();
    }
    return payload;
  });
  res.json(enrichedReports);
});

app.put('/api/reports/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'employee') {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const reportId = Number(req.params.id);
  const report = await getReportById(reportId);
  if (!report) return res.status(404).json({ error: 'Rapport introuvable.' });
  if (!isReportEditable(report, req.session.user)) {
    return res.status(400).json({ error: 'La période de modification est expirée.' });
  }
  const title = (req.body.title || '').trim();
  const content = (req.body.content || '').trim();
  if (!title || !content) {
    return res.status(400).json({ error: 'Le titre et le contenu sont requis.' });
  }
  const updated = await updateReport(reportId, title, content);
  res.json(updated);
});

app.post('/api/comments', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'boss') {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const reportId = Number(req.body.reportId);
  const text = (req.body.text || '').trim();
  if (!reportId || !text) {
    return res.status(400).json({ error: 'ID du rapport et texte du commentaire sont requis.' });
  }
  const report = await getReportById(reportId);
  if (!report) return res.status(404).json({ error: 'Rapport introuvable.' });
  const comment = await createComment(reportId, req.session.user.username, text);
  res.json(comment);
});

app.get('/api/comments/:reportId', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
  const reportId = Number(req.params.reportId);
  const list = await getCommentsForReport(reportId);
  res.json(list);
});

app.post('/api/projects', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'boss') return res.status(403).json({ error: 'Accès refusé' });
  const name = (req.body.name || '').trim();
  const description = (req.body.description || '').trim();
  const matricules = Array.isArray(req.body.assignees) ? req.body.assignees.map(a => a.trim().toUpperCase()).filter(Boolean) : [];
  if (!name || !description || matricules.length === 0) {
    return res.status(400).json({ error: 'Nom, cahier de charge et au moins un employé sont requis.' });
  }
  const resolvedUsernames = [];
  for (const mat of matricules) {
    const username = await fetchUsernameByMatricule(mat);
    if (!username) {
      return res.status(400).json({ error: `Aucun employé trouvé avec le matricule: ${mat}` });
    }
    resolvedUsernames.push(username);
  }
  const project = await createProject(name, description, req.session.user.username, resolvedUsernames);
  res.json(project);
});

app.get('/api/projects', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
  const visible = await getProjectsForUser(req.session.user);
  res.json(visible.map(getProjectWithExtras));
});

app.get('/api/projects/archive', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
  const visible = await getProjectsArchiveForUser(req.session.user);
  res.json(visible.map(getProjectWithExtras));
});

app.put('/api/projects/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'boss') return res.status(403).json({ error: 'Accès refusé' });
  const projectId = Number(req.params.id);
  const project = await getProjectById(projectId);
  if (!project) return res.status(404).json({ error: 'Projet introuvable.' });
  const name = (req.body.name || '').trim();
  const description = (req.body.description || '').trim();
  if (!name || !description) return res.status(400).json({ error: 'Nom et cahier de charge sont requis.' });
  const updated = await updateProject(projectId, name, description);
  res.json(getProjectWithExtras(updated));
});

app.put('/api/projects/:id/assignees', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'boss') return res.status(403).json({ error: 'Accès refusé' });
  const access = await ensureProjectAccess(req, res);
  if (!access) return;
  const { project } = access;
  const assignees = Array.isArray(req.body.assignees) ? req.body.assignees.map(a => (a || '').trim()).filter(Boolean) : null;
  if (assignees === null || assignees.length === 0) {
    return res.status(400).json({ error: 'Au moins un assigné est requis.' });
  }
  const existingUsers = await getEmployeeUsers();
  const known = new Set(existingUsers.map(u => u.username));
  const invalid = assignees.find(username => !known.has(username));
  if (invalid) return res.status(400).json({ error: `Employ\u00e9 introuvable: ${invalid}` });

  // Atomic replace
  const prev = new Set(project.assigned_employees || project.assignedEmployees || []);
  project.assigned_employees = assignees;
  project.assignedEmployees = assignees;
  // status_by_employee: keep statuses of current assignees, drop removed, default new as 'assigned'
  const statusMap = project.status_by_employee || project.statusByEmployee || {};
  const nextStatus = {};
  for (const u of assignees) {
    nextStatus[u] = statusMap[u] || 'assigned';
  }
  project.status_by_employee = nextStatus;
  project.statusByEmployee = nextStatus;
  // Drop submissions from removed employees
  if (useDb) {
    project.submissions = (project.submissions || []).filter(s => assignees.includes(s.employee));
  } else {
    project.submissions = (project.submissions || []).filter(s => assignees.includes(s.employee));
  }
  project.archived = project.archived || false;
  await saveProject(project);
  const removed = [...prev].filter(u => !assignees.includes(u));
  const added = assignees.filter(u => !prev.has(u));
  res.json({ ...getProjectWithExtras(project), _meta: { added, removed } });
});

app.post('/api/projects/:id/accept', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'employee') return res.status(403).json({ error: 'Accès refusé' });
  const projectId = Number(req.params.id);
  const project = await getProjectById(projectId);
  if (!project) return res.status(404).json({ error: 'Projet introuvable.' });
  const assigned = project.assigned_employees || project.assignedEmployees || [];
  if (!assigned.includes(req.session.user.username)) return res.status(403).json({ error: 'Vous n’êtes pas assigné à ce projet.' });
  const updated = await acceptProject(project, req.session.user.username);
  res.json(getProjectWithExtras(updated));
});

app.post('/api/projects/:id/submit', upload.single('attachment'), async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'employee') return res.status(403).json({ error: 'Accès refusé' });
  const projectId = Number(req.params.id);
  const project = await getProjectById(projectId);
  if (!project) return res.status(404).json({ error: 'Projet introuvable.' });
  const assigned = project.assigned_employees || project.assignedEmployees || [];
  if (!assigned.includes(req.session.user.username)) return res.status(403).json({ error: 'Vous n’êtes pas assigné à ce projet.' });
  const submissionType = (req.body.type || '').trim();
  const text = (req.body.text || '').trim();
  if (!['devis', 'cahier', 'rapport'].includes(submissionType)) {
    return res.status(400).json({ error: 'Type de soumission invalide.' });
  }
  let attachment = null;
  if (req.file) {
    try {
      attachment = await storeFile(req.file);
    } catch (err) {
      console.error('Error uploading submission attachment to storage:', err);
      return res.status(500).json({ error: 'Erreur lors de l’enregistrement de la pièce jointe.' });
    }
  }
  const submission = await createProjectSubmission(project, req.session.user.username, submissionType, text, attachment);
  res.json(submission);
});

app.post('/api/projects/:id/messages', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
  const projectId = Number(req.params.id);
  const project = await getProjectById(projectId);
  if (!project) return res.status(404).json({ error: 'Projet introuvable.' });
  const assigned = project.assigned_employees || project.assignedEmployees || [];
  if (req.session.user.role === 'employee' && !assigned.includes(req.session.user.username)) {
    return res.status(403).json({ error: 'Vous n’êtes pas assigné à ce projet.' });
  }
  const text = (req.body.text || '').trim();
  let replyTo = null;
  if (req.body.replyTo) {
    try { replyTo = req.body.replyTo; } catch (e) {}
  }
  if (!text) return res.status(400).json({ error: 'Le message est requis.' });
  const message = await addProjectMessage(project, req.session.user.username, text, [], replyTo);
  res.json(message);
});

// Message with optional attachment (multipart).
app.post('/api/projects/:id/messages/attachment', upload.array('attachment', 10), async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
  const access = await ensureProjectAccess(req, res);
  if (!access) return;
  const text = (req.body.text || '').trim();
  let replyTo = null;
  if (req.body.replyTo) {
    try { replyTo = JSON.parse(req.body.replyTo); } catch (e) {}
  }
  let attachments = [];
  if (req.files && req.files.length) {
    try {
      for (const file of req.files) {
        const stored = await storeFile(file);
        attachments.push(stored);
      }
    } catch (err) {
      console.error('Error uploading message attachments to storage:', err);
      return res.status(500).json({ error: 'Erreur lors de l’enregistrement des fichiers joints.' });
    }
  }
  if (!text && attachments.length === 0) return res.status(400).json({ error: 'Message vide (texte ou fichier requis).' });
  const message = await addProjectMessage(access.project, req.session.user.username, text, attachments, replyTo);
  res.json(message);
});

app.post('/api/projects/:id/archive', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'boss') return res.status(403).json({ error: 'Accès refusé' });
  const projectId = Number(req.params.id);
  const project = await getProjectById(projectId);
  if (!project) return res.status(404).json({ error: 'Projet introuvable.' });
  const archived = await archiveProject(project);
  res.json(getProjectWithExtras(archived));
});

app.get('/api/projects/:id/messages', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
  const access = await ensureProjectAccess(req, res);
  if (!access) return;
  const messages = (access.project.messages || []).slice().sort((a, b) => new Date(a.createdAt || a.created_at) - new Date(b.createdAt || b.created_at));
  res.json(messages);
});

app.post('/api/projects/:id/files', upload.array('files', 10), async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
  const access = await ensureProjectAccess(req, res);
  if (!access) return;
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Aucun fichier reçu.' });
  }
  const now = new Date().toISOString();
  const uploaded = [];
  try {
    for (const f of req.files) {
      const stored = await storeFile(f);
      uploaded.push({
        ...stored,
        uploadedBy: req.session.user.username,
        createdAt: now
      });
    }
  } catch (err) {
    console.error('Error uploading multiple files to storage:', err);
    return res.status(500).json({ error: 'Erreur lors de l’enregistrement des fichiers.' });
  }
  access.project.files = (access.project.files || []).concat(uploaded);
  await saveProject(access.project);
  res.json({ files: access.project.files });
});

app.delete('/api/projects/:id/files/:filename', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'boss') return res.status(403).json({ error: 'Accès refusé' });
  const access = await ensureProjectAccess(req, res);
  if (!access) return;
  const filename = req.params.filename;
  const before = (access.project.files || []).length;
  access.project.files = (access.project.files || []).filter(f => f.filename !== filename);
  if (access.project.files.length === before) {
    return res.status(404).json({ error: 'Fichier introuvable.' });
  }
  // Best-effort unlink on disk.
  if (!CLOUDINARY_CONFIGURED) {
    const onDisk = path.join(UPLOAD_DIR, filename);
    try { fs.unlinkSync(onDisk); } catch (_) {}
  }
  await saveProject(access.project);
  res.json({ files: access.project.files });
});

app.delete('/api/projects/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'boss') return res.status(403).json({ error: 'Accès refusé' });
  const access = await ensureProjectAccess(req, res);
  if (!access) return;
  const wantsArchive = req.query.archive === '1';
  if (wantsArchive) {
    await archiveProject(access.project);
    return res.json({ ok: true, archived: true });
  }
  await removeProject(access.project);
  res.json({ ok: true, archived: false });
});

app.get('/api/projects/:id', async (req, res) => {
  const access = await ensureProjectAccess(req, res);
  if (!access) return;
  res.json(getProjectWithExtras(access.project));
});

// Multer error handler so HTTP responses stay JSON even on bad mime / size.
app.use((err, req, res, next) => {
  if (err && (err.code === 'LIMIT_FILE_SIZE' || /Type de fichier non autoris/i.test(err.message || ''))) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

app.listen(PORT, async () => {
  if (useDb) {
    await initDb();
    console.log('Connecté à la base PostgreSQL.');
  }
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
