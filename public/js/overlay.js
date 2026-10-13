// Client Script for OBS Overlay (v2 : fluide + plein ecran 1920)
const socket = io();

// DOM
const overlayWrapper = document.getElementById('overlayWrapper');
const multiplexBar = document.getElementById('multiplexBar');
const badgeText = document.getElementById('badgeText');
const tickerViewport = document.getElementById('tickerViewport');
const tickerTrack = document.getElementById('tickerTrack');
const goalBanner = document.getElementById('goalBanner');
const goalTeamText = document.getElementById('goalTeamText');

// State
let matches = [];
let settings = {
  badgeText: 'EN DIRECT',
  badgeBg: '#e0457b',
  badgeColor: '#ffffff',
  barBg: '#12040a',
  barBorderColor: '#ff3d85',
  textColor: '#ffffff',
  scoreColor: '#ff8fb8',
  displayMode: 'marquee',
  marqueeSpeed: 70,
  carouselInterval: 6,
  barPosition: 'bottom',
  barHeight: 64,
  fontSize: 22,
  soundOnGoal: false
};

// Derniers scores connus (pour l'animation "pop" quand un score change)
const lastScores = {};

// ---------- Son de but ----------
// L'aperçu de l'admin (iframe) reste muet pour ne pas doubler le son.
// Seule une source navigateur OBS (window.obsstudio) joue le son, ou une page ouverte avec ?sound=1.
// Ainsi un onglet Chrome/Edge qui affiche l'overlay ne double pas le son.
const URL_PARAMS = new URLSearchParams(location.search);
const IS_PREVIEW = URL_PARAMS.has('preview');
const CAN_PLAY_SOUND = !IS_PREVIEW && (typeof window.obsstudio !== 'undefined' || URL_PARAMS.get('sound') === '1');

function playGoalSound(force = false) {
  if (!CAN_PLAY_SOUND) return;
  if (!force && !settings.soundOnGoal) return;

  const volume = Math.min(1, Math.max(0, (Number(settings.goalVolume) || 0) / 100));

  // Uniquement le son envoyé depuis le panneau admin (aucun son par défaut)
  if (!settings.goalSoundFile) return;

  const audio = new Audio(`/sounds/${settings.goalSoundFile}?v=${settings.goalSoundVersion || 0}`);
  audio.volume = volume;
  audio.play().catch(e => console.warn('Lecture du son bloquée/impossible:', e));
}

// ---------- HTML d'un match ----------
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildMatchHtml(match) {
  const isLive = match.status === 'live';
  const isUpcoming = match.status === 'upcoming';
  const isHalftime = match.status === 'halftime';
  const isFinished = match.status === 'finished';

  const dot = isLive ? '<span class="live-dot"></span>' : '';

  const score = isUpcoming
    ? '<span class="score-dash">—</span>'
    : `<span>${match.homeScore}</span><span class="score-dash">-</span><span>${match.awayScore}</span>`;

  // Pas de minute : juste "EN COURS" ou "FINI"
  let status = '';
  if (isLive || isHalftime) {
    status = '<span class="status-badge status-live">En cours</span>';
  } else if (isFinished) {
    status = '<span class="status-badge status-finished">Fini</span>';
  }

  return `<div class="match-item" data-match-id="${match.id}">${dot}<span class="team-name team-home">${escapeHtml(match.homeTeam)}</span><span class="score-badge">${score}</span><span class="team-name team-away">${escapeHtml(match.awayTeam)}</span>${status}</div>`;
}

// ---------- Reglages visuels ----------
function applySettings() {
  const root = document.documentElement;
  root.style.setProperty('--accent', settings.barBorderColor || '#ff3d85');
  root.style.setProperty('--accent-soft', hexToRgba(settings.barBorderColor || '#ff3d85', 0.45));
  root.style.setProperty('--badge-bg', settings.badgeBg || '#e0457b');
  root.style.setProperty('--bar-h', `${settings.barHeight || 64}px`);

  if (badgeText) badgeText.textContent = settings.badgeText || 'EN DIRECT';
  const badge = document.getElementById('badgeBlock');
  if (badge) badge.style.color = settings.badgeColor || '#ffffff';

  if (multiplexBar) {
    multiplexBar.style.backgroundColor = settings.barBg || '#12040a';
    multiplexBar.style.fontSize = `${settings.fontSize || 22}px`;
    if (settings.fontFamily) multiplexBar.style.fontFamily = settings.fontFamily;
  }

  if (overlayWrapper) {
    overlayWrapper.className = `overlay-wrapper pos-${settings.barPosition || 'bottom'}`;
  }
}

function hexToRgba(hex, alpha) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return `rgba(255,61,133,${alpha})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}

// Applique couleurs equipes/scores sur les elements presents
function colorizeItems() {
  tickerTrack.querySelectorAll('.team-name').forEach(el => {
    el.style.color = settings.textColor || '#ffffff';
  });
  tickerTrack.querySelectorAll('.score-badge').forEach(el => {
    el.style.color = settings.scoreColor || '#ff8fb8';
  });
}

// ---------- MARQUEE (fluide : position conservee entre les mises a jour) ----------
let marqueeAnimId = null;
let scrollX = 0;
let lastTs = 0;
let cycleWidth = 0;

function measureWidth(html) {
  const m = document.createElement('div');
  m.className = 'ticker-track measure';
  m.innerHTML = html;
  tickerViewport.appendChild(m);
  const w = m.offsetWidth;
  tickerViewport.removeChild(m);
  return w;
}

function setupMarquee(visible) {
  tickerTrack.className = 'ticker-track';

  if (visible.length === 0) {
    stopMarquee();
    tickerTrack.style.transform = 'translate3d(0,0,0)';
    tickerTrack.innerHTML = '<div class="match-item"><span class="team-name">Aucun match programmé</span></div>';
    return;
  }

  const single = visible.map(buildMatchHtml).join('');
  const w = measureWidth(single) || 1000;

  const minWidth = (window.innerWidth || 1920) + 200;
  let copies = 1;
  while (w * copies < minWidth) copies++;

  const cycle = single.repeat(copies);
  cycleWidth = w * copies;
  tickerTrack.innerHTML = cycle + cycle;

  // Conserve la position pour eviter tout saut visible
  if (cycleWidth > 0) scrollX = -(Math.abs(scrollX) % cycleWidth);

  if (!marqueeAnimId) {
    lastTs = performance.now();
    marqueeAnimId = requestAnimationFrame(marqueeLoop);
  }
}

function marqueeLoop(now) {
  // dt borne : evite un grand saut apres une pause de l'onglet / OBS
  const dt = Math.min((now - lastTs) / 1000, 0.05);
  lastTs = now;

  const speed = Number(settings.marqueeSpeed) || 70;
  scrollX -= speed * dt;
  if (cycleWidth > 0 && scrollX <= -cycleWidth) scrollX += cycleWidth;

  tickerTrack.style.transform = `translate3d(${scrollX.toFixed(2)}px,0,0)`;
  marqueeAnimId = requestAnimationFrame(marqueeLoop);
}

function stopMarquee() {
  if (marqueeAnimId) {
    cancelAnimationFrame(marqueeAnimId);
    marqueeAnimId = null;
  }
}

// ---------- CARROUSEL ----------
let carouselTimer = null;
let carouselPage = 0;
const MATCHES_PER_PAGE = 4;

function stopCarousel() {
  if (carouselTimer) {
    clearInterval(carouselTimer);
    carouselTimer = null;
  }
}

function setupCarousel(visible) {
  stopMarquee();
  stopCarousel();
  tickerTrack.style.transform = 'translate3d(0,0,0)';

  if (visible.length === 0) {
    tickerTrack.className = 'ticker-track';
    tickerTrack.innerHTML = '<div class="match-item"><span class="team-name">Aucun match</span></div>';
    return;
  }

  const pages = [];
  for (let i = 0; i < visible.length; i += MATCHES_PER_PAGE) {
    pages.push(visible.slice(i, i + MATCHES_PER_PAGE));
  }

  carouselPage = Math.min(carouselPage, pages.length - 1);
  showCarouselPage(pages, true);

  if (pages.length > 1) {
    carouselTimer = setInterval(() => {
      carouselPage = (carouselPage + 1) % pages.length;
      showCarouselPage(pages, false);
    }, (settings.carouselInterval || 6) * 1000);
  }
}

function showCarouselPage(pages, immediate) {
  const html = (pages[carouselPage] || []).map(buildMatchHtml).join('');
  if (immediate) {
    tickerTrack.className = 'ticker-carousel carousel-enter';
    tickerTrack.innerHTML = html;
    colorizeItems();
    return;
  }
  tickerTrack.className = 'ticker-carousel carousel-exit';
  setTimeout(() => {
    tickerTrack.innerHTML = html;
    tickerTrack.className = 'ticker-carousel carousel-enter';
    colorizeItems();
  }, 450);
}

// ---------- STATIQUE ----------
function setupStatic(visible) {
  stopMarquee();
  stopCarousel();
  tickerTrack.style.transform = 'translate3d(0,0,0)';
  tickerTrack.className = 'ticker-track static-mode';
  tickerTrack.innerHTML = visible.length
    ? visible.map(buildMatchHtml).join('')
    : '<div class="match-item"><span class="team-name">Aucun match</span></div>';
}

// ---------- Rendu principal ----------
function renderOverlay() {
  applySettings();

  const visible = matches.filter(m => m.visible !== false);
  const mode = settings.displayMode || 'marquee';

  if (mode !== 'marquee') stopMarquee();
  if (mode !== 'carousel') stopCarousel();

  if (mode === 'carousel') setupCarousel(visible);
  else if (mode === 'static') setupStatic(visible);
  else setupMarquee(visible);

  colorizeItems();
  popChangedScores(visible);
}

// Petite animation sur les scores qui viennent de changer
function popChangedScores(visible) {
  visible.forEach(m => {
    const key = `${m.homeScore}-${m.awayScore}`;
    if (lastScores[m.id] !== undefined && lastScores[m.id] !== key) {
      tickerTrack.querySelectorAll(`[data-match-id="${m.id}"] .score-badge`).forEach(el => {
        el.classList.add('score-pop');
        setTimeout(() => el.classList.remove('score-pop'), 1000);
      });
    }
    lastScores[m.id] = key;
  });
}

// ---------- Alerte BUT ----------
let bannerTimeout = null;
function handleGoalAlert(data) {
  playGoalSound();

  document.querySelectorAll(`[data-match-id="${data.matchId}"]`).forEach(el => {
    el.classList.add('goal-flash');
    setTimeout(() => el.classList.remove('goal-flash'), 8000);
  });

  if (goalBanner && goalTeamText) {
    goalTeamText.textContent = (data.team || 'BUT !').toUpperCase();
    goalBanner.classList.add('show');
    if (bannerTimeout) clearTimeout(bannerTimeout);
    bannerTimeout = setTimeout(() => goalBanner.classList.remove('show'), 5000);
  }
}

// ---------- Socket ----------
socket.on('init', (data) => {
  matches = data.matches || [];
  settings = { ...settings, ...data.settings };
  renderOverlay();
});

socket.on('matches:updated', (newMatches) => {
  matches = newMatches;
  renderOverlay();
});

socket.on('settings:updated', (newSettings) => {
  settings = { ...settings, ...newSettings };
  renderOverlay();
});

socket.on('match:goal_alert', handleGoalAlert);
socket.on('sound:test', () => playGoalSound(true));

// Re-mesure quand les polices sont chargees / fenetre redimensionnee
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { if (matches.length) renderOverlay(); });
}
window.addEventListener('resize', () => { if (matches.length) renderOverlay(); });
