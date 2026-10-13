// Tournament Overlay Client Script
const socket = io();

let tournament = {
  title: 'TOURNOI DES CHAMPIONS',
  groupsCount: 2,
  activeOverlayView: 'groups',
  participants: [],
  groups: [],
  groupMatches: [],
  playoffs: {},
  drawLive: {}
};

// DOM Elements
const root = document.getElementById('tournamentOverlayRoot');
const overlayTournamentTitle = document.getElementById('overlayTournamentTitle');
const viewTagBadge = document.getElementById('viewTagBadge');

const viewGroups = document.getElementById('viewGroups');
const viewDraw = document.getElementById('viewDraw');
const viewPlayoffs = document.getElementById('viewPlayoffs');

const overlayGroupsGrid = document.getElementById('overlayGroupsGrid');
const drawSphere = document.getElementById('drawSphere');
const drawSphereNumber = document.getElementById('drawSphereNumber');
const drawPickedName = document.getElementById('drawPickedName');
const drawPickedTeam = document.getElementById('drawPickedTeam');
const drawGroupsTarget = document.getElementById('drawGroupsTarget');

// Helper: Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getParticipant(id) {
  return (tournament.participants || []).find(p => p.id === id) || { name: '---', team: '' };
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

    Object.values(stats).forEach(s => {
      s.diff = s.gf - s.ga;
    });

    const sorted = Object.values(stats).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.diff !== a.diff) return b.diff - a.diff;
      return b.gf - a.gf;
    });

    standingsByGroup[g.id] = sorted;
  });

  return standingsByGroup;
}

// Render Main
function renderOverlay() {
  if (!tournament) return;

  const currentView = tournament.activeOverlayView || 'groups';

  // Visibility
  if (currentView === 'hidden') {
    root.className = 'tournament-overlay-root view-hidden';
    return;
  }
  root.className = `tournament-overlay-root view-${currentView}`;

  // Title
  if (overlayTournamentTitle) {
    overlayTournamentTitle.textContent = tournament.title || 'TOURNOI DES CHAMPIONS';
  }

  // Switch View Container
  [viewGroups, viewDraw, viewPlayoffs].forEach(v => {
    if (v) v.classList.remove('active');
  });

  if (currentView === 'groups') {
    if (viewGroups) viewGroups.classList.add('active');
    if (viewTagBadge) viewTagBadge.textContent = 'POULES & CLASSEMENT';
    renderGroupsView();
  } else if (currentView === 'draw') {
    if (viewDraw) viewDraw.classList.add('active');
    if (viewTagBadge) viewTagBadge.textContent = 'TIRAGE AU SORT EN DIRECT';
    renderDrawView();
  } else if (currentView === 'playoffs') {
    if (viewPlayoffs) viewPlayoffs.classList.add('active');
    if (viewTagBadge) viewTagBadge.textContent = 'PHASE FINALE (PLAYOFFS)';
    renderPlayoffsView();
  }
}

// 1. Render Groups & Standings
function renderGroupsView() {
  if (!overlayGroupsGrid) return;
  const groups = tournament.groups || [];
  const standings = computeAllStandings();

  if (groups.length === 0) {
    overlayGroupsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding:100px; font-family:'Oswald',sans-serif; font-size:32px; color:#ff8fb8;">
        EN ATTENTE DU TIRAGE DES POULES
      </div>
    `;
    return;
  }

  overlayGroupsGrid.innerHTML = groups.map(g => {
    const list = standings[g.id] || [];
    return `
      <div class="tourn-card-group">
        <div class="tourn-group-title">
          <span>${escapeHtml(g.name)}</span>
          <span style="font-size:14px; color:var(--accent-light);">${list.length} Équipes</span>
        </div>
        <table class="tourn-group-table">
          <thead>
            <tr>
              <th class="col-rank">#</th>
              <th class="col-player">Joueur & Équipe</th>
              <th>J</th>
              <th>G</th>
              <th>N</th>
              <th>P</th>
              <th>Diff</th>
              <th class="col-pts">Pts</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((s, idx) => `
              <tr>
                <td class="col-rank">${idx + 1}</td>
                <td class="col-player">
                  <div class="player-pname">${escapeHtml(s.name)}</div>
                  <div class="player-pteam">${escapeHtml(s.team)}</div>
                </td>
                <td>${s.played}</td>
                <td>${s.won}</td>
                <td>${s.drawn}</td>
                <td>${s.lost}</td>
                <td style="color:${s.diff > 0 ? '#10b981' : (s.diff < 0 ? '#ef4444' : 'inherit')}">
                  ${s.diff > 0 ? '+' : ''}${s.diff}
                </td>
                <td class="col-pts">${s.pts}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }).join('');
}

// 2. Render Draw View
function renderDrawView() {
  const drawLive = tournament.drawLive || {};
  const revealedIds = drawLive.revealedIds || [];
  const groups = tournament.groups || [];

  // Active Picked Ball
  if (revealedIds.length > 0) {
    const lastId = revealedIds[revealedIds.length - 1];
    const p = getParticipant(lastId);
    if (drawPickedName) drawPickedName.textContent = p.name;
    if (drawPickedTeam) drawPickedTeam.textContent = p.team || 'ÉQUIPE';
    if (drawSphereNumber) drawSphereNumber.textContent = revealedIds.length;
  } else {
    if (drawPickedName) drawPickedName.textContent = 'PRÊT POUR LE TIRAGE';
    if (drawPickedTeam) drawPickedTeam.textContent = 'LANCEZ LE TIRAGE DEPUIS L\'ADMIN';
    if (drawSphereNumber) drawSphereNumber.textContent = '🎲';
  }

  // Target Groups Slots
  if (drawGroupsTarget) {
    drawGroupsTarget.innerHTML = groups.map(g => {
      // Pour chaque équipe du groupe, vérifie si elle a été révélée
      return `
        <div class="draw-group-box">
          <h4>${escapeHtml(g.name)}</h4>
          <div class="draw-group-slots">
            ${g.teamIds.map(tId => {
              const isRevealed = revealedIds.includes(tId);
              const p = getParticipant(tId);
              return `
                <div class="draw-slot ${isRevealed ? 'filled' : ''}">
                  <span>${isRevealed ? escapeHtml(p.name) : '---'}</span>
                  <span style="color:var(--accent-light); font-size:12px;">${isRevealed ? escapeHtml(p.team) : ''}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');
  }
}

// 3. Render Playoffs View
function renderPlayoffsView() {
  const p = tournament.playoffs || {};

  // Semi 1
  if (p.semi1) {
    setEl('overlaySemi1Home', p.semi1.home || '1er Poule A');
    setEl('overlaySemi1Away', p.semi1.away || '2ème Poule B');
    setEl('overlaySemi1ScoreH', p.semi1.homeScore || 0);
    setEl('overlaySemi1ScoreA', p.semi1.awayScore || 0);
  }

  // Semi 2
  if (p.semi2) {
    setEl('overlaySemi2Home', p.semi2.home || '1er Poule B');
    setEl('overlaySemi2Away', p.semi2.away || '2ème Poule A');
    setEl('overlaySemi2ScoreH', p.semi2.homeScore || 0);
    setEl('overlaySemi2ScoreA', p.semi2.awayScore || 0);
  }

  // Final
  if (p.final) {
    setEl('overlayFinalHome', p.final.home || 'Finaliste 1');
    setEl('overlayFinalAway', p.final.away || 'Finaliste 2');
    setEl('overlayFinalScoreH', p.final.homeScore || 0);
    setEl('overlayFinalScoreA', p.final.awayScore || 0);
    setEl('overlayWinnerName', p.final.winner && p.final.winner.trim() ? p.final.winner : '---');
  }
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// Socket Events
socket.on('init', (data) => {
  tournament = data.tournament || tournament;
  renderOverlay();
});

socket.on('tournament:updated', (updatedTournament) => {
  tournament = updatedTournament;
  renderOverlay();
});
