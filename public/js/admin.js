// Admin Dashboard Script
const socket = io();

// State
let matches = [];
let settings = {};

// DOM Elements
const connectionStatus = document.getElementById('connectionStatus');
const matchesList = document.getElementById('matchesList');
const matchesCount = document.getElementById('matchesCount');
const previewIframe = document.getElementById('previewIframe');
const toast = document.getElementById('toast');

// Settings Elements
const settingBadgeText = document.getElementById('settingBadgeText');
const settingBadgeBg = document.getElementById('settingBadgeBg');
const settingBadgeBgHex = document.getElementById('settingBadgeBgHex');
const settingBadgeColor = document.getElementById('settingBadgeColor');
const settingBadgeColorHex = document.getElementById('settingBadgeColorHex');
const settingBarBg = document.getElementById('settingBarBg');
const settingBarBgHex = document.getElementById('settingBarBgHex');
const settingBarBorderColor = document.getElementById('settingBarBorderColor');
const settingBarBorderColorHex = document.getElementById('settingBarBorderColorHex');
const settingScoreColor = document.getElementById('settingScoreColor');
const settingScoreColorHex = document.getElementById('settingScoreColorHex');
const settingTextColor = document.getElementById('settingTextColor');
const settingTextColorHex = document.getElementById('settingTextColorHex');
const settingDisplayMode = document.getElementById('settingDisplayMode');
const settingMarqueeSpeed = document.getElementById('settingMarqueeSpeed');
const speedValue = document.getElementById('speedValue');
const settingBarHeight = document.getElementById('settingBarHeight');
const heightValue = document.getElementById('heightValue');
const settingFontSize = document.getElementById('settingFontSize');
const fontValue = document.getElementById('fontValue');
const settingBarPosition = document.getElementById('settingBarPosition');
const settingSoundOnGoal = document.getElementById('settingSoundOnGoal');
const btnSaveSettings = document.getElementById('btnSaveSettings');

// Modal Elements
const addMatchModal = document.getElementById('addMatchModal');
const btnAddMatchModal = document.getElementById('btnAddMatchModal');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnCancelModal = document.getElementById('btnCancelModal');
const addMatchForm = document.getElementById('addMatchForm');

// Navigation & Actions
const btnOpenOverlay = document.getElementById('btnOpenOverlay');
const btnCopyOverlayUrl = document.getElementById('btnCopyOverlayUrl');
const btnCopyCode = document.getElementById('btnCopyCode');
const btnRefreshPreview = document.getElementById('btnRefreshPreview');
const presetSelect = document.getElementById('presetSelect');
const btnClearMatches = document.getElementById('btnClearMatches');
const obsUrlDisplay = document.getElementById('obsUrlDisplay');

// Initialize OBS URL with dynamic host
const overlayUrl = `${window.location.protocol}//${window.location.host}/overlay`;
if (obsUrlDisplay) obsUrlDisplay.textContent = overlayUrl;

// Toast Helper
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

// Socket Connection Status
socket.on('connect', () => {
  connectionStatus.textContent = 'CONNECTÉ EN DIRECT';
  connectionStatus.parentElement.style.background = 'rgba(16, 185, 129, 0.15)';
  connectionStatus.parentElement.style.color = '#34d399';
});

socket.on('disconnect', () => {
  connectionStatus.textContent = 'DÉCONNECTÉ';
  connectionStatus.parentElement.style.background = 'rgba(239, 68, 68, 0.15)';
  connectionStatus.parentElement.style.color = '#f87171';
});

// Sync data on load
socket.on('init', (data) => {
  matches = data.matches || [];
  settings = data.settings || {};
  renderMatches();
  populateSettingsForm();
});

socket.on('matches:updated', (updatedMatches) => {
  matches = updatedMatches;
  renderMatches();
});

socket.on('settings:updated', (updatedSettings) => {
  settings = updatedSettings;
  populateSettingsForm();
});

// Render Match Cards
function renderMatches() {
  matchesCount.textContent = matches.length;

  if (matches.length === 0) {
    matchesList.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
        <p style="font-size: 16px; margin-bottom: 8px;">Aucun match dans le multiplex.</p>
        <p style="font-size: 13px;">Cliquez sur <strong>➕ Nouveau match</strong> ou choisissez un exemple ci-dessus.</p>
      </div>
    `;
    return;
  }

  matchesList.innerHTML = matches.map((match, index) => {
    const isFirst = index === 0;
    const isLast = index === matches.length - 1;
    const isHidden = match.visible === false;

    return `
      <div class="match-row ${isHidden ? 'hidden-match' : ''}" data-id="${match.id}">
        <!-- Reorder buttons -->
        <div class="match-reorder">
          <button onclick="moveMatch(${index}, -1)" ${isFirst ? 'disabled style="opacity:0.2;"' : ''} title="Monter">▲</button>
          <button onclick="moveMatch(${index}, 1)" ${isLast ? 'disabled style="opacity:0.2;"' : ''} title="Descendre">▼</button>
        </div>

        <!-- Home Team -->
        <div class="team-input-group">
          <input type="text" class="team-name-input" value="${escapeHtml(match.homeTeam)}" 
            placeholder="Équipe Domicile"
            onchange="updateMatchField('${match.id}', 'homeTeam', this.value)">
        </div>

        <!-- Scores -->
        <div class="score-control">
          <button type="button" onclick="adjustScore('${match.id}', 'homeScore', -1)">-</button>
          <input type="number" min="0" value="${match.homeScore}" 
            onchange="updateMatchField('${match.id}', 'homeScore', parseInt(this.value) || 0)">
          <button type="button" onclick="adjustScore('${match.id}', 'homeScore', 1)">+</button>

          <span class="score-separator">:</span>

          <button type="button" onclick="adjustScore('${match.id}', 'awayScore', -1)">-</button>
          <input type="number" min="0" value="${match.awayScore}" 
            onchange="updateMatchField('${match.id}', 'awayScore', parseInt(this.value) || 0)">
          <button type="button" onclick="adjustScore('${match.id}', 'awayScore', 1)">+</button>
        </div>

        <!-- Away Team -->
        <div class="team-input-group">
          <input type="text" class="team-name-input" value="${escapeHtml(match.awayTeam)}" 
            placeholder="Équipe Extérieur"
            onchange="updateMatchField('${match.id}', 'awayTeam', this.value)">
        </div>

        <!-- Statut -->
        <select class="status-select" onchange="updateMatchField('${match.id}', 'status', this.value)">
          <option value="live" ${(match.status === 'live' || match.status === 'halftime') ? 'selected' : ''}>🔴 En cours</option>
          <option value="upcoming" ${match.status === 'upcoming' ? 'selected' : ''}>⏳ À venir</option>
          <option value="finished" ${match.status === 'finished' ? 'selected' : ''}>🏁 Fini</option>
        </select>

        <!-- Action Buttons -->
        <div class="match-actions">
          <button class="btn btn-secondary btn-icon" onclick="triggerGoalAlert('${match.id}')" title="Déclencher alerte BUT !">
            ⚽
          </button>
          <button class="btn btn-secondary btn-icon" onclick="toggleVisibility('${match.id}')" title="${isHidden ? 'Afficher' : 'Masquer'}">
            ${isHidden ? '🕶️' : '👁️'}
          </button>
          <button class="btn btn-danger btn-icon" onclick="deleteMatch('${match.id}')" title="Supprimer le match">
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Field update dispatcher
window.updateMatchField = function(id, field, value) {
  const match = matches.find(m => m.id === id);
  if (match) {
    const updated = { ...match, [field]: value };
    socket.emit('match:update', updated);
    showToast('Match mis à jour');
  }
};

// Quick Score Adjust (+1 / -1)
window.adjustScore = function(id, field, delta) {
  const match = matches.find(m => m.id === id);
  if (match) {
    const newScore = Math.max(0, (Number(match[field]) || 0) + delta);
    const updated = { ...match, [field]: newScore };
    socket.emit('match:update', updated);
    if (delta > 0) {
      const scoringTeam = field === 'homeScore' ? match.homeTeam : match.awayTeam;
      showToast(`⚽ BUT pour ${scoringTeam} ! (${updated.homeScore}-${updated.awayScore})`);
    } else {
      showToast('Score ajusté');
    }
  }
};

// Reorder matches
window.moveMatch = function(index, delta) {
  const targetIndex = index + delta;
  if (targetIndex < 0 || targetIndex >= matches.length) return;

  const newMatches = [...matches];
  const item = newMatches.splice(index, 1)[0];
  newMatches.splice(targetIndex, 0, item);

  socket.emit('matches:reorder', newMatches);
};

// Toggle match visibility
window.toggleVisibility = function(id) {
  const match = matches.find(m => m.id === id);
  if (match) {
    const updated = { ...match, visible: match.visible === false ? true : false };
    socket.emit('match:update', updated);
    showToast(updated.visible ? 'Match affiché sur l\'overlay' : 'Match masqué');
  }
};

// Trigger manual goal alert
window.triggerGoalAlert = function(id) {
  const match = matches.find(m => m.id === id);
  if (match) {
    socket.emit('match:trigger_goal', { matchId: id, team: match.homeTeam });
    showToast(`Alerte BUT déclenchée pour ${match.homeTeam} !`);
  }
};

// Delete match
window.deleteMatch = function(id) {
  const match = matches.find(m => m.id === id);
  const matchName = match ? `${match.homeTeam} vs ${match.awayTeam}` : 'ce match';
  if (confirm(`Confirmer la suppression de ${matchName} ?`)) {
    socket.emit('match:delete', id);
    showToast('Match supprimé');
  }
};

// Clear all matches
btnClearMatches.addEventListener('click', () => {
  if (confirm('Voulez-vous vraiment supprimer TOUS les matchs du multiplex ?')) {
    socket.emit('matches:clear');
    showToast('Tous les matchs ont été supprimés');
  }
});

// Load Presets
presetSelect.addEventListener('change', (e) => {
  const val = e.target.value;
  if (val) {
    socket.emit('matches:load_preset', val);
    showToast('Exemple chargé avec succès !');
    e.target.value = '';
  }
});

// Modal Logic
btnAddMatchModal.addEventListener('click', () => {
  addMatchModal.classList.add('open');
  document.getElementById('newHomeTeam').focus();
});

function closeModal() {
  addMatchModal.classList.remove('open');
  addMatchForm.reset();
}

btnCloseModal.addEventListener('click', closeModal);
btnCancelModal.addEventListener('click', closeModal);

addMatchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const homeTeam = document.getElementById('newHomeTeam').value.trim();
  const awayTeam = document.getElementById('newAwayTeam').value.trim();
  const homeScore = parseInt(document.getElementById('newHomeScore').value) || 0;
  const awayScore = parseInt(document.getElementById('newAwayScore').value) || 0;
  const status = document.getElementById('newStatus').value;

  if (!homeTeam || !awayTeam) return;

  socket.emit('match:add', {
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    status,
    visible: true
  });

  closeModal();
  showToast(`Match "${homeTeam} vs ${awayTeam}" ajouté !`);
});

// SETTINGS SYNC & FORM
function populateSettingsForm() {
  if (settings.badgeText !== undefined) settingBadgeText.value = settings.badgeText;
  if (settings.badgeBg) {
    settingBadgeBg.value = settings.badgeBg;
    settingBadgeBgHex.textContent = settings.badgeBg;
  }
  if (settings.badgeColor) {
    settingBadgeColor.value = settings.badgeColor;
    settingBadgeColorHex.textContent = settings.badgeColor;
  }
  if (settings.barBg) {
    settingBarBg.value = settings.barBg;
    settingBarBgHex.textContent = settings.barBg;
  }
  if (settings.barBorderColor) {
    settingBarBorderColor.value = settings.barBorderColor;
    settingBarBorderColorHex.textContent = settings.barBorderColor;
  }
  if (settings.scoreColor) {
    settingScoreColor.value = settings.scoreColor;
    settingScoreColorHex.textContent = settings.scoreColor;
  }
  if (settings.textColor) {
    settingTextColor.value = settings.textColor;
    settingTextColorHex.textContent = settings.textColor;
  }
  if (settings.displayMode) settingDisplayMode.value = settings.displayMode;
  if (settings.marqueeSpeed) {
    settingMarqueeSpeed.value = settings.marqueeSpeed;
    speedValue.textContent = settings.marqueeSpeed;
  }
  if (settings.barHeight) {
    settingBarHeight.value = settings.barHeight;
    heightValue.textContent = settings.barHeight;
  }
  if (settings.fontSize) {
    settingFontSize.value = settings.fontSize;
    fontValue.textContent = settings.fontSize;
  }
  if (settings.barPosition) settingBarPosition.value = settings.barPosition;
  if (settings.soundOnGoal !== undefined) settingSoundOnGoal.checked = settings.soundOnGoal;
  if (settings.goalVolume !== undefined) {
    document.getElementById('settingGoalVolume').value = settings.goalVolume;
    document.getElementById('goalVolumeValue').textContent = settings.goalVolume;
  }
  document.getElementById('soundFileName').textContent =
    settings.goalSoundFile ? `🎵 ${settings.goalSoundName || settings.goalSoundFile}` : 'Aucun son';
}

// Bind live color inputs
function bindColorInput(input, hexLabel) {
  input.addEventListener('input', (e) => {
    hexLabel.textContent = e.target.value;
  });
}
bindColorInput(settingBadgeBg, settingBadgeBgHex);
bindColorInput(settingBadgeColor, settingBadgeColorHex);
bindColorInput(settingBarBg, settingBarBgHex);
bindColorInput(settingBarBorderColor, settingBarBorderColorHex);
bindColorInput(settingScoreColor, settingScoreColorHex);
bindColorInput(settingTextColor, settingTextColorHex);

settingMarqueeSpeed.addEventListener('input', (e) => {
  speedValue.textContent = e.target.value;
});
settingBarHeight.addEventListener('input', (e) => {
  heightValue.textContent = e.target.value;
});
settingFontSize.addEventListener('input', (e) => {
  fontValue.textContent = e.target.value;
});

btnSaveSettings.addEventListener('click', () => {
  const updatedSettings = {
    badgeText: settingBadgeText.value.trim() || 'EN DIRECT',
    badgeBg: settingBadgeBg.value,
    badgeColor: settingBadgeColor.value,
    barBg: settingBarBg.value,
    barBorderColor: settingBarBorderColor.value,
    scoreColor: settingScoreColor.value,
    textColor: settingTextColor.value,
    displayMode: settingDisplayMode.value,
    marqueeSpeed: parseInt(settingMarqueeSpeed.value) || 70,
    barHeight: parseInt(settingBarHeight.value) || 64,
    fontSize: parseInt(settingFontSize.value) || 22,
    barPosition: settingBarPosition.value,
    soundOnGoal: settingSoundOnGoal.checked
  };

  socket.emit('settings:update', updatedSettings);
  showToast('Paramètres enregistrés et diffusés en direct !');
});

// Copy Buttons
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Lien copié dans le presse-papiers !');
  }).catch(() => {
    prompt('Copiez ce lien :', text);
  });
}

btnCopyOverlayUrl.addEventListener('click', () => copyToClipboard(overlayUrl));
btnCopyCode.addEventListener('click', () => copyToClipboard(overlayUrl));

btnOpenOverlay.addEventListener('click', () => {
  window.open('/overlay', '_blank');
});

btnRefreshPreview.addEventListener('click', () => {
  previewIframe.src = '/overlay?preview=1&t=' + Date.now();
  showToast('Aperçu rechargé');
});

// Aperçu en vraie largeur 1920, réduit pour tenir dans la carte
function scalePreview() {
  const frame = previewIframe.parentElement;
  const scale = frame.clientWidth / 1920;
  previewIframe.style.transform = `scale(${scale})`;
  frame.style.height = `${120 * scale}px`;
}
window.addEventListener('resize', scalePreview);
scalePreview();

// ---------- SON DE BUT ----------
const soundFileInput = document.getElementById('soundFileInput');
const settingGoalVolume = document.getElementById('settingGoalVolume');
const goalVolumeValue = document.getElementById('goalVolumeValue');

// Activer / désactiver : appliqué tout de suite
settingSoundOnGoal.addEventListener('change', () => {
  socket.emit('settings:update', { soundOnGoal: settingSoundOnGoal.checked });
  showToast(settingSoundOnGoal.checked ? 'Son de but activé' : 'Son de but désactivé');
});

// Volume : label en direct, envoi au relâchement
settingGoalVolume.addEventListener('input', (e) => {
  goalVolumeValue.textContent = e.target.value;
});
settingGoalVolume.addEventListener('change', (e) => {
  socket.emit('settings:update', { goalVolume: parseInt(e.target.value) || 0 });
  showToast(`Volume du son : ${e.target.value}%`);
});

// Envoi du fichier audio au serveur
soundFileInput.addEventListener('change', async () => {
  const file = soundFileInput.files[0];
  if (!file) return;
  if (file.size > 30 * 1024 * 1024) {
    alert('Fichier trop lourd (30 Mo max).');
    soundFileInput.value = '';
    return;
  }
  try {
    showToast('Envoi du son en cours...');
    const res = await fetch('/api/upload-sound?name=' + encodeURIComponent(file.name), {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
    showToast('Son de but enregistré !');
  } catch (err) {
    alert('Échec de l\'envoi : ' + err.message);
  }
  soundFileInput.value = '';
});

// Test dans l'overlay (donc dans OBS)
document.getElementById('btnTestSoundOverlay').addEventListener('click', () => {
  socket.emit('sound:test');
  showToast('Son envoyé à l\'overlay');
});

// Écoute locale dans ce navigateur
document.getElementById('btnTestSoundLocal').addEventListener('click', () => {
  if (!settings.goalSoundFile) {
    showToast('Aucun fichier son enregistré');
    return;
  }
  const audio = new Audio(`/sounds/${settings.goalSoundFile}?v=${settings.goalSoundVersion || 0}`);
  audio.volume = (parseInt(settingGoalVolume.value) || 0) / 100;
  audio.play().catch(() => showToast('Lecture impossible (format non supporté ?)'));
});

// Retirer le son personnalisé
document.getElementById('btnRemoveSound').addEventListener('click', async () => {
  if (!settings.goalSoundFile) return;
  await fetch('/api/sound', { method: 'DELETE' });
  showToast('Son retiré');
});

