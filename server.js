const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.set('trust proxy', 1); // derrière le proxy HTTPS de l'hébergeur
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
// DATA_DIR : dossier persistant (volume/disque de l'hébergeur). Par défaut ./data
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ---------- Authentification admin ----------
// ADMIN_PASSWORD défini => le panneau /admin et toutes les modifications sont protégés.
// L'overlay (/overlay) reste public en lecture seule (pour OBS).
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const AUTH_ENABLED = ADMIN_PASSWORD !== '';

if (!AUTH_ENABLED && process.env.NODE_ENV === 'production') {
  console.error('\n❌ ADMIN_PASSWORD manquant : en production le panneau admin doit être protégé.');
  console.error('   Définis la variable d\'environnement ADMIN_PASSWORD puis relance.\n');
  process.exit(1);
}

const AUTH_TOKEN = crypto.createHmac('sha256', ADMIN_PASSWORD || 'local').update('multiplex-admin').digest('hex');
const COOKIE_NAME = 'mx_admin';

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function isAdminRequest(req) {
  if (!AUTH_ENABLED) return true;
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  return !!token && safeEqual(token, AUTH_TOKEN);
}

function requireAdmin(req, res, next) {
  if (isAdminRequest(req)) return next();
  if (req.method === 'GET' && (req.path === '/admin' || req.path.endsWith('.html'))) {
    return res.redirect('/login');
  }
  return res.status(401).json({ error: 'Non autorisé' });
}

// Anti brute-force simple : 8 essais ratés / 15 min / IP
const failedLogins = new Map();
function tooManyAttempts(ip) {
  const rec = failedLogins.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.first > 15 * 60 * 1000) { failedLogins.delete(ip); return false; }
  return rec.count >= 8;
}
function registerFail(ip) {
  const rec = failedLogins.get(ip);
  if (!rec || Date.now() - rec.first > 15 * 60 * 1000) failedLogins.set(ip, { count: 1, first: Date.now() });
  else rec.count++;
}

// Helpers to load / save
function loadJson(file, fallback) {
  try {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`Erreur lecture ${file}:`, err);
  }
  return fallback;
}

function saveJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Erreur sauvegarde ${file}:`, err);
  }
}

let matches = loadJson(MATCHES_FILE, []);
let settings = loadJson(SETTINGS_FILE, {
  badgeText: "EN DIRECT",
  badgeBg: "#e0457b",
  badgeColor: "#ffffff",
  barBg: "#12040a",
  barBorderColor: "#ff3d85",
  textColor: "#ffffff",
  scoreColor: "#ff8fb8",
  displayMode: "marquee", // "marquee" | "carousel" | "static"
  marqueeSpeed: 70,
  carouselInterval: 6,
  barPosition: "bottom",
  barHeight: 64,
  fontSize: 22,
  fontFamily: "Montserrat, 'Segoe UI', sans-serif",
  soundOnGoal: false,
  goalSoundFile: "",
  goalSoundName: "",
  goalSoundVersion: 0,
  goalVolume: 80
});

// Middleware
app.use(express.json());
// Fichiers réservés à l'admin : protégés quand ADMIN_PASSWORD est défini
app.get(['/admin.html', '/js/admin.js', '/css/admin.css'], requireAdmin);
app.use(express.static(path.join(__dirname, 'public')));

// ---- Sons personnalisés (son de but) ----
const SOUNDS_DIR = path.join(DATA_DIR, 'sounds');
if (!fs.existsSync(SOUNDS_DIR)) fs.mkdirSync(SOUNDS_DIR, { recursive: true });
app.use('/sounds', express.static(SOUNDS_DIR));

const ALLOWED_AUDIO = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm', '.opus'];

function clearGoalSounds() {
  fs.readdirSync(SOUNDS_DIR).forEach(f => {
    if (f.startsWith('goal-sound.')) fs.unlinkSync(path.join(SOUNDS_DIR, f));
  });
}

app.post('/api/upload-sound', requireAdmin, express.raw({ type: '*/*', limit: '30mb' }), (req, res) => {
  const originalName = String(req.query.name || 'son.mp3');
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_AUDIO.includes(ext)) {
    return res.status(400).json({ error: `Format non supporté (${ext}). Formats : ${ALLOWED_AUDIO.join(', ')}` });
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'Fichier vide' });
  }
  try {
    clearGoalSounds();
    const stored = `goal-sound${ext}`;
    fs.writeFileSync(path.join(SOUNDS_DIR, stored), req.body);
    settings.goalSoundFile = stored;
    settings.goalSoundName = originalName;
    settings.goalSoundVersion = Date.now();
    settings.soundOnGoal = true;
    saveJson(SETTINGS_FILE, settings);
    io.emit('settings:updated', settings);
    res.json({ ok: true, settings });
  } catch (err) {
    console.error('Erreur upload son:', err);
    res.status(500).json({ error: 'Erreur serveur lors de l\'enregistrement' });
  }
});

app.delete('/api/sound', requireAdmin, (req, res) => {
  clearGoalSounds();
  settings.goalSoundFile = '';
  settings.goalSoundName = '';
  settings.goalSoundVersion = Date.now();
  saveJson(SETTINGS_FILE, settings);
  io.emit('settings:updated', settings);
  res.json({ ok: true, settings });
});

// ---- Connexion admin ----
function loginPage(error) {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connexion - Multiplex TV</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0709;color:#f8fafc;font-family:Segoe UI,Arial,sans-serif}
  form{background:#140d11;border:1px solid #3a2230;border-radius:12px;padding:32px;width:320px;box-shadow:0 8px 30px rgba(0,0,0,.5)}
  h1{margin:0 0 6px;font-size:20px} p{margin:0 0 20px;color:#94a3b8;font-size:13px}
  input{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:6px;border:1px solid #3a2230;background:#0f0a0d;color:#fff;font-size:15px;margin-bottom:14px}
  input:focus{outline:none;border-color:#ff3d85}
  button{width:100%;padding:11px;border:0;border-radius:6px;background:linear-gradient(135deg,#ff3d85,#c42a63);color:#fff;font-weight:700;font-size:15px;cursor:pointer}
  .err{color:#ff8fa8;font-size:13px;margin-bottom:12px}
</style></head><body>
<form method="POST" action="/login">
  <h1>⚽ Multiplex TV</h1><p>Panneau de contrôle - accès protégé</p>
  ${error ? `<div class="err">${error}</div>` : ''}
  <input type="password" name="password" placeholder="Mot de passe" autofocus required>
  <button type="submit">Se connecter</button>
</form></body></html>`;
}

app.get('/login', (req, res) => {
  if (!AUTH_ENABLED || isAdminRequest(req)) return res.redirect('/admin');
  res.send(loginPage(''));
});

app.post('/login', express.urlencoded({ extended: false }), (req, res) => {
  if (!AUTH_ENABLED) return res.redirect('/admin');
  if (tooManyAttempts(req.ip)) {
    return res.status(429).send(loginPage('Trop de tentatives. Réessaie dans 15 minutes.'));
  }
  const given = String((req.body && req.body.password) || '');
  if (safeEqual(given, ADMIN_PASSWORD)) {
    failedLogins.delete(req.ip);
    const flags = `HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 3600}${req.secure ? '; Secure' : ''}`;
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${AUTH_TOKEN}; ${flags}`);
    return res.redirect('/admin');
  }
  registerFail(req.ip);
  res.status(401).send(loginPage('Mot de passe incorrect.'));
});

app.get('/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.redirect('/login');
});

// Routes
app.get('/', (req, res) => {
  res.redirect('/admin');
});

app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/overlay', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'overlay.html'));
});

// REST fallback API
app.get('/api/state', (req, res) => {
  res.json({ matches, settings });
});

// Presets
const PRESETS = {
  ligue1: [
    { id: 'm1', homeTeam: 'Paris SG', awayTeam: 'Marseille', homeScore: 2, awayScore: 1, status: 'live', minute: "68'", visible: true },
    { id: 'm2', homeTeam: 'Lyon', awayTeam: 'Monaco', homeScore: 1, awayScore: 0, status: 'live', minute: "72'", visible: true },
    { id: 'm3', homeTeam: 'Lens', awayTeam: 'Lille', homeScore: 0, awayScore: 0, status: 'halftime', minute: "MT", visible: true },
    { id: 'm4', homeTeam: 'Rennes', awayTeam: 'Nantes', homeScore: 3, awayScore: 2, status: 'finished', minute: "FIN", visible: true },
    { id: 'm5', homeTeam: 'Nice', awayTeam: 'Brest', homeScore: 0, awayScore: 0, status: 'upcoming', minute: "21h00", visible: true }
  ],
  championsLeague: [
    { id: 'cl1', homeTeam: 'Real Madrid', awayTeam: 'Man City', homeScore: 3, awayScore: 3, status: 'live', minute: "84'", visible: true },
    { id: 'cl2', homeTeam: 'Arsenal', awayTeam: 'Bayern', homeScore: 2, awayScore: 2, status: 'live', minute: "79'", visible: true },
    { id: 'cl3', homeTeam: 'Barcelone', awayTeam: 'PSG', homeScore: 1, awayScore: 4, status: 'finished', minute: "FIN", visible: true },
    { id: 'cl4', homeTeam: 'Atlético', awayTeam: 'Dortmund', homeScore: 2, awayScore: 1, status: 'finished', minute: "FIN", visible: true }
  ],
  screenshotExample: [
    { id: 'ex1', homeTeam: 'Équipe A', awayTeam: 'Équipe B', homeScore: 2, awayScore: 1, status: 'live', minute: "", visible: true },
    { id: 'ex2', homeTeam: 'Équipe C', awayTeam: 'Équipe D', homeScore: 0, awayScore: 0, status: 'live', minute: "", visible: true },
    { id: 'ex3', homeTeam: 'Équipe E', awayTeam: 'Équipe F', homeScore: 0, awayScore: 0, status: 'upcoming', minute: "", visible: true },
    { id: 'ex4', homeTeam: 'Équipe G', awayTeam: 'Équipe H', homeScore: 3, awayScore: 0, status: 'live', minute: "", visible: true }
  ]
};

// Les clients non-admin (ex: OBS) peuvent seulement RECEVOIR les mises à jour
io.use((socket, next) => {
  socket.data.isAdmin = isAdminRequest(socket.request);
  next();
});

// WebSocket Logic
io.on('connection', (socket) => {
  // Tout événement reçu d'un client est une modification => réservé à l'admin
  socket.use((packet, next) => {
    if (socket.data.isAdmin) return next();
    next(new Error('Non autorisé'));
  });
  socket.on('error', () => {});

  // Send current state on connect
  socket.emit('init', { matches, settings });

  // Update match
  socket.on('match:update', (updatedMatch) => {
    const index = matches.findIndex(m => m.id === updatedMatch.id);
    if (index !== -1) {
      const prev = matches[index];
      const hadGoal = (updatedMatch.homeScore > prev.homeScore) || (updatedMatch.awayScore > prev.awayScore);
      matches[index] = { ...matches[index], ...updatedMatch };
      saveJson(MATCHES_FILE, matches);
      io.emit('matches:updated', matches);

      if (hadGoal) {
        const team = updatedMatch.homeScore > prev.homeScore ? updatedMatch.homeTeam : updatedMatch.awayTeam;
        io.emit('match:goal_alert', {
          matchId: updatedMatch.id,
          team,
          match: matches[index]
        });
      }
    }
  });

  // Add match
  socket.on('match:add', (newMatch) => {
    const match = {
      id: 'match-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      homeTeam: newMatch.homeTeam || 'Équipe 1',
      awayTeam: newMatch.awayTeam || 'Équipe 2',
      homeScore: Number(newMatch.homeScore) || 0,
      awayScore: Number(newMatch.awayScore) || 0,
      status: newMatch.status || 'live',
      minute: newMatch.minute || '',
      visible: newMatch.visible !== false
    };
    matches.push(match);
    saveJson(MATCHES_FILE, matches);
    io.emit('matches:updated', matches);
  });

  // Delete match
  socket.on('match:delete', (matchId) => {
    matches = matches.filter(m => m.id !== matchId);
    saveJson(MATCHES_FILE, matches);
    io.emit('matches:updated', matches);
  });

  // Reorder matches
  socket.on('matches:reorder', (newOrder) => {
    if (Array.isArray(newOrder)) {
      matches = newOrder;
      saveJson(MATCHES_FILE, matches);
      io.emit('matches:updated', matches);
    }
  });

  // Trigger Goal Alert manually
  socket.on('match:trigger_goal', (data) => {
    const match = matches.find(m => m.id === data.matchId);
    if (match) {
      io.emit('match:goal_alert', {
        matchId: match.id,
        team: data.team || match.homeTeam,
        match
      });
    }
  });

  // Test du son de but (joué uniquement par l'overlay, sans alerte visuelle)
  socket.on('sound:test', () => {
    io.emit('sound:test');
  });

  // Update Settings
  socket.on('settings:update', (newSettings) => {
    settings = { ...settings, ...newSettings };
    saveJson(SETTINGS_FILE, settings);
    io.emit('settings:updated', settings);
  });

  // Apply preset
  socket.on('matches:load_preset', (presetKey) => {
    if (PRESETS[presetKey]) {
      matches = JSON.parse(JSON.stringify(PRESETS[presetKey]));
      saveJson(MATCHES_FILE, matches);
      io.emit('matches:updated', matches);
    }
  });

  // Clear all matches
  socket.on('matches:clear', () => {
    matches = [];
    saveJson(MATCHES_FILE, matches);
    io.emit('matches:updated', matches);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`⚽ MULTIPLEX LIVE OVERLAY SERVER ACTIF !`);
  console.log(`💻 Panneau de contrôle : http://localhost:${PORT}/admin`);
  console.log(`📺 Source Navigateur OBS : http://localhost:${PORT}/overlay`);
  console.log(`🔒 Mot de passe admin : ${AUTH_ENABLED ? 'ACTIVÉ' : 'désactivé (usage local uniquement)'}`);
  console.log(`💾 Données : ${DATA_DIR}`);
  console.log(`======================================================\n`);
});
