/*
 * teamRegistration.js
 * Dynamic team loader and validation utilities.
 * Loads team data from `/teams.json` in the browser via fetch or from
 * `./teams.json` on Node via fs. Exposes both sync helpers (once loaded)
 * and async helpers that ensure data is loaded before validating.
 */

let teams = []; // will be populated by loadTeamsFromJSON

function normalizeString(s) {
  return String(s || '').trim().toLowerCase();
}

async function loadTeamsFromJSON(path = '/teams.json') {
  // Browser environment
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    // If the page or another script embedded the teams, use that first
    if (Array.isArray(window.__TEAMS__)) {
      teams = window.__TEAMS__.map(t => ({ team_number: Number(t.team_number), nickname: String(t.nickname || '') }));
      return teams;
    }

    const attempted = new Set();
    function addCandidate(u) { if (u && !attempted.has(u)) attempted.add(u); }

    // Candidate based on provided path
    if (path) {
      try { addCandidate(new URL(path, location.href).href); } catch (e) { addCandidate(path); }
    }

    // Try same directory as the currently running script
    if (document.currentScript && document.currentScript.src) {
      try {
        const scriptDir = new URL('.', document.currentScript.src).href;
        addCandidate(new URL('teams.json', scriptDir).href);
      } catch (e) {}
    }

    // Try same directory as the document and walk up to root
    try {
      let dir = new URL('.', location.href).href;
      addCandidate(new URL('teams.json', dir).href);

      // Walk up directories, adding ../teams.json variations
      let up = '';
      for (let i = 0; i < 6; i++) {
        up += '../';
        try { addCandidate(new URL(up + 'teams.json', location.href).href); } catch (e) {}
      }

      // Root candidate
      try { addCandidate(location.origin + '/teams.json'); } catch (e) {}
    } catch (e) {}

    // Fallback simple relative candidates
    addCandidate('./teams.json');
    addCandidate('/teams.json');

    // Try each candidate until one succeeds
    for (const url of attempted) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const json = await res.json();
        if (Array.isArray(json)) {
          teams = json.map(t => ({ team_number: Number(t.team_number), nickname: String(t.nickname || '') }));
          return teams;
        }
      } catch (e) {
        // continue trying other candidates
      }
    }

    throw new Error('Failed to fetch teams.json from any known location. Tried: ' + Array.from(attempted).join(', '));
  }

  // Node environment
  if (typeof require === 'function') {
    const fs = require('fs');
    const pathModule = require('path');
    const candidates = [];
    if (path) {
      candidates.push(pathModule.isAbsolute(path) ? path : pathModule.resolve(__dirname, path));
    }
    candidates.push(pathModule.resolve(__dirname, 'teams.json'));
    candidates.push(pathModule.resolve(__dirname, '..', 'teams.json'));
    candidates.push(pathModule.resolve(process.cwd(), 'teams.json'));

    for (const fp of candidates) {
      try {
        if (fs.existsSync(fp)) {
          const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
          teams = raw.map(t => ({ team_number: Number(t.team_number), nickname: String(t.nickname || '') }));
          return teams;
        }
      } catch (e) {
        // try next
      }
    }

    throw new Error('Failed to load teams.json from any known path');
  }

  throw new Error('No supported environment to load teams.json');
}

function findTeamByNumberSync(teamNumber) {
  const num = Number(teamNumber);
  if (Number.isNaN(num)) return null;
  return teams.find(t => t.team_number === num) || null;
}

async function findTeamByNumber(teamNumber, options) {
  if (!teams.length) await loadTeamsFromJSON(options && options.path);
  return findTeamByNumberSync(teamNumber);
}

function validateTeamNumberAndNameSync(teamNumberInput, teamNameInput) {
  const team = findTeamByNumberSync(teamNumberInput);
  if (!team) return { ok: false, reason: 'team-number-not-registered' };
  if (normalizeString(team.nickname) !== normalizeString(teamNameInput)) {
    return { ok: false, reason: 'team-name-mismatch', expected: team.nickname };
  }
  return { ok: true, team };
}

async function validateTeamNumberAndName(teamNumberInput, teamNameInput, options) {
  if (!teams.length) await loadTeamsFromJSON(options && options.path);
  return validateTeamNumberAndNameSync(teamNumberInput, teamNameInput);
}

function getAllTeamsSync() {
  return teams.slice();
}

async function getAllTeams(options) {
  if (!teams.length) await loadTeamsFromJSON(options && options.path);
  return teams.slice();
}

const api = {
  teams,
  loadTeamsFromJSON,
  findTeamByNumberSync,
  findTeamByNumber,
  validateTeamNumberAndNameSync,
  validateTeamNumberAndName,
  getAllTeamsSync,
  getAllTeams
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}

if (typeof window !== 'undefined') {
  window.teamRegistration = api;
}

