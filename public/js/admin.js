// Admin Dashboard Script
const socket = io();

// State
let matches = [];
let settings = {};
let tournament = {};

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
  tournament = data.tournament || {};
  renderMatches();
  populateSettingsForm();
  if (typeof renderTournament === 'function') renderTournament();
});

socket.on('matches:updated', (updatedMatches) => {
  matches = updatedMatches;
  renderMatches();
});

socket.on('tournament:updated', (updatedTournament) => {
  tournament = updatedTournament;
  if (typeof renderTournament === 'function') renderTournament();
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

// ==================================================
// TABS SWITCHING
// ==================================================
const tabBtnMultiplex = document.getElementById('tabBtnMultiplex');
const tabBtnTournament = document.getElementById('tabBtnTournament');
const tabContentMultiplex = document.getElementById('tabContentMultiplex');
const tabContentTournament = document.getElementById('tabContentTournament');

if (tabBtnMultiplex && tabBtnTournament) {
  tabBtnMultiplex.addEventListener('click', () => {
    tabBtnMultiplex.classList.add('active');
    tabBtnTournament.classList.remove('active');
    tabContentMultiplex.classList.add('active');
    tabContentTournament.classList.remove('active');
  });
  tabBtnTournament.addEventListener('click', () => {
    tabBtnTournament.classList.add('active');
    tabBtnMultiplex.classList.remove('active');
    tabContentTournament.classList.add('active');
    tabContentMultiplex.classList.remove('active');
    renderTournament();
  });
}

// ==================================================
// TOURNAMENT CONTROLLER
// ==================================================
const tournamentTitleInput = document.getElementById('tournamentTitleInput');
const btnOpenTournamentOverlay = document.getElementById('btnOpenTournamentOverlay');
const btnCopyTournamentOverlayUrl = document.getElementById('btnCopyTournamentOverlayUrl');
const btnExportToMultiplex = document.getElementById('btnExportToMultiplex');
const participantsCount = document.getElementById('participantsCount');
const participantsList = document.getElementById('participantsList');
const addParticipantForm = document.getElementById('addParticipantForm');
const newPlayerName = document.getElementById('newPlayerName');
const newPlayerTeam = document.getElementById('newPlayerTeam');
const btnPresetParticipants = document.getElementById('btnPresetParticipants');
const selectGroupsCount = document.getElementById('selectGroupsCount');
const btnRandomDraw = document.getElementById('btnRandomDraw');
const btnStepDraw = document.getElementById('btnStepDraw');
const btnResetDraw = document.getElementById('btnResetDraw');
const drawProgressBox = document.getElementById('drawProgressBox');
const groupsTablesContainer = document.getElementById('groupsTablesContainer');
const groupMatchesCount = document.getElementById('groupMatchesCount');
const groupMatchesList = document.getElementById('groupMatchesList');
const btnAutoFillPlayoffs = document.getElementById('btnAutoFillPlayoffs');
const btnSavePlayoffs = document.getElementById('btnSavePlayoffs');

const tournamentOverlayUrl = `${window.location.protocol}//${window.location.host}/tournament-overlay`;

if (btnOpenTournamentOverlay) {
  btnOpenTournamentOverlay.addEventListener('click', () => window.open('/tournament-overlay', '_blank'));
}
if (btnCopyTournamentOverlayUrl) {
  btnCopyTournamentOverlayUrl.addEventListener('click', () => copyToClipboard(tournamentOverlayUrl));
}

// Title Change
if (tournamentTitleInput) {
  tournamentTitleInput.addEventListener('change', () => {
    socket.emit('tournament:update', { title: tournamentTitleInput.value.trim() });
    showToast('Titre du tournoi mis à jour');
  });
}

// Overlay View Selector Buttons
document.querySelectorAll('.btn-view').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    socket.emit('tournament:set_view', view);
    showToast(`Vue overlay : ${btn.textContent.trim()}`);
  });
});

// Add participant
if (addParticipantForm) {
  addParticipantForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = newPlayerName.value.trim();
    const team = newPlayerTeam.value.trim();
    if (!name || !team) return;

    const list = tournament.participants || [];
    const newP = {
      id: 'p-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      name,
      team
    };
    list.push(newP);
    socket.emit('tournament:update', { participants: list });
    newPlayerName.value = '';
    newPlayerTeam.value = '';
    newPlayerName.focus();
    showToast(`Participant ${name} ajouté !`);
  });
}

// Preset 8 participants
if (btnPresetParticipants) {
  btnPresetParticipants.addEventListener('click', () => {
    const sample = [
      { id: 'p1', name: 'Riton', team: 'Real Madrid' },
      { id: 'p2', name: 'Alex', team: 'Manchester City' },
      { id: 'p3', name: 'Lucas', team: 'Paris SG' },
      { id: 'p4', name: 'Nico', team: 'Bayern Munich' },
      { id: 'p5', name: 'Thomas', team: 'Arsenal' },
      { id: 'p6', name: 'Julien', team: 'Barcelone' },
      { id: 'p7', name: 'Maxime', team: 'Inter Milan' },
      { id: 'p8', name: 'Antoine', team: 'Liverpool' }
    ];
    socket.emit('tournament:update', { participants: sample });
    showToast('Exemple de 8 joueurs chargé');
  });
}

// Delete participant
window.deleteParticipant = function(pId) {
  const list = (tournament.participants || []).filter(p => p.id !== pId);
  socket.emit('tournament:update', { participants: list });
  showToast('Participant retiré');
};

// Random Draw Button
if (btnRandomDraw) {
  btnRandomDraw.addEventListener('click', () => {
    const participants = tournament.participants || [];
    if (participants.length < 2) {
      alert('Veuillez ajouter au moins 2 participants avant de faire le tirage.');
      return;
    }
    const gCount = parseInt(selectGroupsCount.value) || 2;
    socket.emit('tournament:draw_random', { groupsCount: gCount });
    showToast('🎲 Tirage au sort effectué et matchs de poule générés !');
  });
}

// Reset Draw Button
if (btnResetDraw) {
  btnResetDraw.addEventListener('click', () => {
    if (confirm('Voulez-vous réinitialiser les poules et les matchs ?')) {
      socket.emit('tournament:update', {
        groups: [],
        groupMatches: [],
        drawLive: { isDrawing: false, currentStep: 0, revealedIds: [] }
      });
      showToast('Poules et matchs réinitialisés');
    }
  });
}

// Step by Step Draw
if (btnStepDraw) {
  btnStepDraw.addEventListener('click', () => {
    const participants = tournament.participants || [];
    if (participants.length === 0) return;

    let drawLive = tournament.drawLive || { isDrawing: false, currentStep: 0, revealedIds: [] };
    const allIds = participants.map(p => p.id);

    if (drawLive.revealedIds.length >= allIds.length) {
      showToast('Toutes les boules ont déjà été tirées !');
      return;
    }

    // Prochaine boule
    const remaining = allIds.filter(id => !drawLive.revealedIds.includes(id));
    const nextPicked = remaining[Math.floor(Math.random() * remaining.length)];
    const newRevealed = [...drawLive.revealedIds, nextPicked];

    socket.emit('tournament:draw_step', {
      isDrawing: true,
      currentStep: newRevealed.length,
      revealedIds: newRevealed
    });
    showToast(`🎲 Boule tirée : ${getParticipantName(nextPicked)} !`);
  });
}

// Match Score Change in Groups
window.changeGroupScore = function(matchId, field, delta) {
  const match = (tournament.groupMatches || []).find(m => m.id === matchId);
  if (match) {
    const newScore = Math.max(0, (match[field] || 0) + delta);
    socket.emit('tournament:match_score', {
      matchId,
      homeScore: field === 'homeScore' ? newScore : match.homeScore,
      awayScore: field === 'awayScore' ? newScore : match.awayScore,
      played: true
    });
  }
};

window.toggleGroupMatchPlayed = function(matchId, isPlayed) {
  const match = (tournament.groupMatches || []).find(m => m.id === matchId);
  if (match) {
    socket.emit('tournament:match_score', {
      matchId,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      played: isPlayed
    });
  }
};

// Export to Multiplex ticker
if (btnExportToMultiplex) {
  btnExportToMultiplex.addEventListener('click', () => {
    if (!tournament.groupMatches || tournament.groupMatches.length === 0) {
      alert('Veuillez d\'abord générer les poules et les matchs.');
      return;
    }
    socket.emit('tournament:export_to_multiplex', {});
    showToast('⚡ Tous les matchs du tournoi ont été injectés dans le Multiplex OBS !');
  });
}

// Auto-Fill Playoffs
if (btnAutoFillPlayoffs) {
  btnAutoFillPlayoffs.addEventListener('click', () => {
    const standings = computeAllStandings();
    const groupA = standings['A'] || [];
    const groupB = standings['B'] || [];

    const firstA = groupA[0] ? `${groupA[0].name} (${groupA[0].team})` : '1er Poule A';
    const secondA = groupA[1] ? `${groupA[1].name} (${groupA[1].team})` : '2ème Poule A';
    const firstB = groupB[0] ? `${groupB[0].name} (${groupB[0].team})` : '1er Poule B';
    const secondB = groupB[1] ? `${groupB[1].name} (${groupB[1].team})` : '2ème Poule B';

    document.getElementById('semi1Home').value = firstA;
    document.getElementById('semi1Away').value = secondB;
    document.getElementById('semi2Home').value = firstB;
    document.getElementById('semi2Away').value = secondA;

    showToast('Playoffs remplis avec les qualifiés des poules ! Pense à cliquer sur Enregistrer.');
  });
}

// Save Playoffs
if (btnSavePlayoffs) {
  btnSavePlayoffs.addEventListener('click', () => {
    const playoffsData = {
      semi1: {
        home: document.getElementById('semi1Home').value,
        away: document.getElementById('semi1Away').value,
        homeScore: parseInt(document.getElementById('semi1ScoreH').value) || 0,
        awayScore: parseInt(document.getElementById('semi1ScoreA').value) || 0
      },
      semi2: {
        home: document.getElementById('semi2Home').value,
        away: document.getElementById('semi2Away').value,
        homeScore: parseInt(document.getElementById('semi2ScoreH').value) || 0,
        awayScore: parseInt(document.getElementById('semi2ScoreA').value) || 0
      },
      final: {
        home: document.getElementById('finalHome').value,
        away: document.getElementById('finalAway').value,
        homeScore: parseInt(document.getElementById('finalScoreH').value) || 0,
        awayScore: parseInt(document.getElementById('finalScoreA').value) || 0,
        winner: document.getElementById('finalWinner').value
      }
    };
    socket.emit('tournament:playoff_update', playoffsData);
    showToast('Phase Finale enregistrée avec succès !');
  });
}

// Helper: Participant info
function getParticipant(id) {
  return (tournament.participants || []).find(p => p.id === id) || { name: 'Inconnu', team: '' };
}
function getParticipantName(id) {
  const p = getParticipant(id);
  return p.team ? `${p.name} (${p.team})` : p.name;
}

// Compute group standings
function computeAllStandings() {
  const standingsByGroup = {};
  const groups = tournament.groups || [];
  const matches = tournament.groupMatches || [];

  groups.forEach(g => {
    const stats = {};
    g.teamIds.forEach(id => {
      const p = getParticipant(id);
      stats[id] = {
        id,
        name: p.name,
        team: p.team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        diff: 0,
        pts: 0
      };
    });

    // Parse matches
    matches.filter(m => m.groupId === g.id && m.played).forEach(m => {
      const sH = stats[m.homeId];
      const sA = stats[m.awayId];
      if (sH && sA) {
        sH.played++;
        sA.played++;
        sH.gf += m.homeScore;
        sH.ga += m.awayScore;
        sA.gf += m.awayScore;
        sA.ga += m.homeScore;

        if (m.homeScore > m.awayScore) {
          sH.won++;
          sH.pts += 3;
          sA.lost++;
        } else if (m.homeScore < m.awayScore) {
          sA.won++;
          sA.pts += 3;
          sH.lost++;
        } else {
          sH.drawn++;
          sH.pts += 1;
          sA.drawn++;
          sA.pts += 1;
        }
      }
    });

    // Diff
    Object.values(stats).forEach(s => {
      s.diff = s.gf - s.ga;
    });

    // Sort: Pts DESC, Diff DESC, GF DESC
    const sorted = Object.values(stats).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.diff !== a.diff) return b.diff - a.diff;
      return b.gf - a.gf;
    });

    standingsByGroup[g.id] = sorted;
  });

  return standingsByGroup;
}

// Main Render Function for Tournament tab
function renderTournament() {
  if (!tournament) return;

  // Title
  if (tournamentTitleInput && tournament.title) {
    tournamentTitleInput.value = tournament.title;
  }

  // Active view buttons
  const activeView = tournament.activeOverlayView || 'groups';
  document.querySelectorAll('.btn-view').forEach(btn => {
    btn.classList.toggle('active-view', btn.dataset.view === activeView);
  });

  // Groups Count Select
  if (selectGroupsCount && tournament.groupsCount) {
    selectGroupsCount.value = String(tournament.groupsCount);
  }

  // Participants
  const participants = tournament.participants || [];
  if (participantsCount) participantsCount.textContent = participants.length;

  if (participantsList) {
    if (participants.length === 0) {
      participantsList.innerHTML = '<span style="font-size:12px; color:var(--text-muted);">Aucun participant. Ajoutez-en ou chargez l\'exemple !</span>';
    } else {
      participantsList.innerHTML = participants.map(p => `
        <div class="player-chip">
          <span class="player-name">${escapeHtml(p.name)}</span>
          <span class="player-team">(${escapeHtml(p.team)})</span>
          <span class="chip-del" onclick="deleteParticipant('${p.id}')" title="Supprimer">&times;</span>
        </div>
      `).join('');
    }
  }

  // Draw Status
  if (drawProgressBox) {
    const revealed = (tournament.drawLive && tournament.drawLive.revealedIds) || [];
    drawProgressBox.innerHTML = `Boules tirées : <strong>${revealed.length} / ${participants.length}</strong>`;
  }

  // Groups & Standings Tables
  const standings = computeAllStandings();
  const groups = tournament.groups || [];

  if (groupsTablesContainer) {
    if (groups.length === 0) {
      groupsTablesContainer.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">Aucune poule. Cliquez sur 🎲 <strong>Lancer le Tirage Aléatoire</strong> ci-dessus !</p>';
    } else {
      groupsTablesContainer.innerHTML = groups.map(g => {
        const teamStats = standings[g.id] || [];
        return `
          <div class="group-table-wrap">
            <div class="group-table-header">${escapeHtml(g.name)}</div>
            <table class="group-table">
              <thead>
                <tr>
                  <th style="width:30px;">#</th>
                  <th style="text-align:left; padding-left:14px;">Joueur & Équipe</th>
                  <th>J</th>
                  <th>G</th>
                  <th>N</th>
                  <th>P</th>
                  <th>BP</th>
                  <th>BC</th>
                  <th>Diff</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody>
                ${teamStats.map((s, idx) => `
                  <tr>
                    <td style="font-weight:800; color:${idx < 2 ? '#ff3d85' : 'var(--text-muted)'};">${idx + 1}</td>
                    <td class="team-cell">
                      <span style="font-weight:700; color:#fff;">${escapeHtml(s.name)}</span>
                      <span style="font-size:11px; color:var(--accent-gold); margin-left:4px;">${escapeHtml(s.team)}</span>
                    </td>
                    <td>${s.played}</td>
                    <td>${s.won}</td>
                    <td>${s.drawn}</td>
                    <td>${s.lost}</td>
                    <td>${s.gf}</td>
                    <td>${s.ga}</td>
                    <td style="color:${s.diff > 0 ? '#10b981' : (s.diff < 0 ? '#ef4444' : 'inherit')}">${s.diff > 0 ? '+' : ''}${s.diff}</td>
                    <td class="pts-cell">${s.pts}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }).join('');
    }
  }

  // Group Matches List
  const matches = tournament.groupMatches || [];
  if (groupMatchesCount) groupMatchesCount.textContent = matches.length;

  if (groupMatchesList) {
    if (matches.length === 0) {
      groupMatchesList.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">Les matchs seront générés automatiquement dès le tirage au sort des poules !</p>';
    } else {
      groupMatchesList.innerHTML = matches.map(m => {
        const pH = getParticipant(m.homeId);
        const pA = getParticipant(m.awayId);
        return `
          <div class="group-match-row ${m.played ? 'match-played' : ''}">
            <span style="font-size:11px; font-weight:800; color:#ff8fb8; width:50px;">Poule ${m.groupId}</span>

            <div class="match-team-lbl home">
              <span style="color:#fff;">${escapeHtml(pH.name)}</span>
              <span style="font-size:11px; color:var(--text-muted); display:block;">${escapeHtml(pH.team)}</span>
            </div>

            <div class="match-score-inputs">
              <button class="btn btn-secondary btn-sm" onclick="changeGroupScore('${m.id}', 'homeScore', -1)">-</button>
              <input type="number" class="score-mini-input" value="${m.homeScore}" min="0" onchange="changeGroupScore('${m.id}', 'homeScore', parseInt(this.value) - ${m.homeScore})">
              <button class="btn btn-secondary btn-sm" onclick="changeGroupScore('${m.id}', 'homeScore', 1)">+</button>

              <span style="font-weight:bold; color:#ff3d85; padding:0 2px;">:</span>

              <button class="btn btn-secondary btn-sm" onclick="changeGroupScore('${m.id}', 'awayScore', -1)">-</button>
              <input type="number" class="score-mini-input" value="${m.awayScore}" min="0" onchange="changeGroupScore('${m.id}', 'awayScore', parseInt(this.value) - ${m.awayScore})">
              <button class="btn btn-secondary btn-sm" onclick="changeGroupScore('${m.id}', 'awayScore', 1)">+</button>
            </div>

            <div class="match-team-lbl away">
              <span style="color:#fff;">${escapeHtml(pA.name)}</span>
              <span style="font-size:11px; color:var(--text-muted); display:block;">${escapeHtml(pA.team)}</span>
            </div>

            <label style="font-size:11px; display:flex; align-items:center; gap:4px; cursor:pointer;" title="Marquer le match comme terminé">
              <input type="checkbox" ${m.played ? 'checked' : ''} onchange="toggleGroupMatchPlayed('${m.id}', this.checked)">
              <span style="color:${m.played ? '#10b981' : 'var(--text-muted)'}; font-weight:700;">${m.played ? 'Joué' : 'À jouer'}</span>
            </label>
          </div>
        `;
      }).join('');
    }
  }

  // Playoffs Inputs
  const p = tournament.playoffs || {};
  if (p.semi1) {
    if (document.getElementById('semi1Home')) document.getElementById('semi1Home').value = p.semi1.home || '';
    if (document.getElementById('semi1Away')) document.getElementById('semi1Away').value = p.semi1.away || '';
    if (document.getElementById('semi1ScoreH')) document.getElementById('semi1ScoreH').value = p.semi1.homeScore || 0;
    if (document.getElementById('semi1ScoreA')) document.getElementById('semi1ScoreA').value = p.semi1.awayScore || 0;
  }
  if (p.semi2) {
    if (document.getElementById('semi2Home')) document.getElementById('semi2Home').value = p.semi2.home || '';
    if (document.getElementById('semi2Away')) document.getElementById('semi2Away').value = p.semi2.away || '';
    if (document.getElementById('semi2ScoreH')) document.getElementById('semi2ScoreH').value = p.semi2.homeScore || 0;
    if (document.getElementById('semi2ScoreA')) document.getElementById('semi2ScoreA').value = p.semi2.awayScore || 0;
  }
  if (p.final) {
    if (document.getElementById('finalHome')) document.getElementById('finalHome').value = p.final.home || '';
    if (document.getElementById('finalAway')) document.getElementById('finalAway').value = p.final.away || '';
    if (document.getElementById('finalScoreH')) document.getElementById('finalScoreH').value = p.final.homeScore || 0;
    if (document.getElementById('finalScoreA')) document.getElementById('finalScoreA').value = p.final.awayScore || 0;
    if (document.getElementById('finalWinner')) document.getElementById('finalWinner').value = p.final.winner || '';
  }
}


