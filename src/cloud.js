'use strict';

// Your pet on any computer, through your own GitHub account.
//
// The save lives in one secret Gist of yours ("openmon-save"), with the same
// format as a backup file plus the computer that wrote it. There is no
// Openmon server: the app talks to api.github.com with a token that has only
// the "gist" scope, kept in ~/.openmon/cloud.json.
//
// Sign-in: the GitHub device flow (a code you type on github.com/login/device)
// when OPENMON_GITHUB_CLIENT_ID or the built-in client id is set, otherwise the
// token of the GitHub CLI ("gh auth login") when it has the gist scope. The
// CLI's token can do much more than Gists, so it is never written to disk:
// it is read from gh each time the app starts.
//
// Sync rule, with no clocks compared across computers:
// - the Gist changed elsewhere since our last sync and nothing changed here:
//   pull it;
// - nothing new elsewhere and something changed here: push;
// - both changed (or this computer never synced and already has a pet that
//   grew): ask which one to keep. Never merge, never replace silently.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { homeDir } = require('./store');
const { wrap, unwrap, summary } = require('./backup');

const API = 'https://api.github.com';
const DESCRIPTION = 'openmon-save · your Openmon, synced between computers (do not edit)';
const FILE = 'openmon.json';
// The public id of the Openmon OAuth app (device flow needs no secret).
const CLIENT_ID = process.env.OPENMON_GITHUB_CLIENT_ID || '';

function ghCandidates() {
  const list = ['gh'];
  if (process.platform === 'win32') list.push(path.join(process.env.ProgramFiles || 'C:\\Program Files', 'GitHub CLI', 'gh.exe'));
  else list.push('/opt/homebrew/bin/gh', '/usr/local/bin/gh', '/usr/bin/gh');
  return list;
}

// The GitHub CLI's token, or null. Never printed or logged.
function readGhToken() {
  const tryOne = (bin) =>
    new Promise((resolve) => {
      execFile(bin, ['auth', 'token'], { timeout: 4000, windowsHide: true }, (err, out) => resolve(err ? null : String(out).trim() || null));
    });
  return ghCandidates().reduce((p, bin) => p.then((t) => t || tryOne(bin)), Promise.resolve(null));
}

function createCloud({ file = path.join(homeDir(), 'cloud.json'), fetchImpl = (...a) => fetch(...a), ghToken = readGhToken, clientId = CLIENT_ID, machineName = os.hostname(), now = Date.now } = {}) {
  let st = { token: null, login: null, source: null, gistId: null, machineId: null, lastSync: null, dirty: false, syncedAt: null };
  try {
    st = { ...st, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {}
  if (!st.machineId) st.machineId = crypto.randomBytes(8).toString('hex');
  // Only a device-flow token (gist scope only) is kept in the file.
  let token = st.source === 'device' ? st.token : null;
  let device = null;
  let lastError = null;

  function save() {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const kept = { ...st, token: st.source === 'device' ? token : null };
      fs.writeFileSync(file, `${JSON.stringify(kept, null, 2)}\n`, { mode: 0o600 });
    } catch {}
  }

  async function api(method, url, body) {
    if (!token && st.source === 'gh' && st.login) token = await ghToken();
    if (!token) throw new Error('signed-out');
    const res = await fetchImpl(url.startsWith('http') ? url : `${API}${url}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'openmon',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      // The token was revoked on github.com: sign out here too.
      token = null;
      st.login = null;
      st.source = null;
      save();
      throw new Error('signed-out');
    }
    if (!res.ok) throw new Error(`github ${res.status}`);
    return res;
  }

  async function adopt(newToken, source) {
    token = newToken;
    const res = await api('GET', '/user');
    const scopes = String(res.headers.get('x-oauth-scopes') || '').split(/,\s*/);
    if (source === 'gh' && !scopes.includes('gist')) {
      token = null;
      throw new Error('gh-no-gist');
    }
    const user = await res.json();
    st.login = user.login;
    st.source = source;
    // Another account means another Gist.
    if (st.account !== user.id) {
      st.gistId = null;
      st.lastSync = null;
      st.account = user.id;
    }
    device = null;
    lastError = null;
    save();
    return { ok: true, login: st.login };
  }

  // Signs in with the GitHub CLI's token.
  async function connectGh() {
    const token = await ghToken();
    if (!token) throw new Error('no-gh');
    return adopt(token, 'gh');
  }

  // Starts the device flow: returns the code to type on github.com.
  async function startDevice() {
    if (!clientId) throw new Error('no-device');
    const res = await fetchImpl('https://github.com/login/device/code', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'openmon' },
      body: JSON.stringify({ client_id: clientId, scope: 'gist' }),
    });
    const d = await res.json();
    if (!d.device_code) throw new Error('device-failed');
    device = { userCode: d.user_code, uri: d.verification_uri, expiresAt: now() + d.expires_in * 1000 };
    const code = d.device_code;
    let wait = (d.interval || 5) * 1000;
    const poll = async () => {
      while (device && device.userCode === d.user_code && now() < device.expiresAt) {
        await new Promise((r) => setTimeout(r, wait));
        try {
          const r = await fetchImpl('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'openmon' },
            body: JSON.stringify({ client_id: clientId, device_code: code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
          });
          const t = await r.json();
          if (t.access_token) return adopt(t.access_token, 'device');
          if (t.error === 'slow_down') wait += 5000;
          else if (t.error !== 'authorization_pending') throw new Error(t.error || 'device-failed');
        } catch (err) {
          lastError = err.message;
          device = null;
          throw err;
        }
      }
      device = null;
      throw new Error('expired_token');
    };
    const done = poll();
    done.catch(() => {});
    return { userCode: device.userCode, uri: device.uri, done };
  }

  function logout() {
    token = null;
    st.login = null;
    st.source = null;
    device = null;
    save();
  }

  async function findGist() {
    if (st.gistId) {
      try {
        return await (await api('GET', `/gists/${st.gistId}`)).json();
      } catch (err) {
        if (err.message === 'signed-out') throw err;
        st.gistId = null;
      }
    }
    for (let page = 1; page <= 5; page++) {
      const list = await (await api('GET', `/gists?per_page=100&page=${page}`)).json();
      const hit = list.find((g) => g.description === DESCRIPTION && g.files && g.files[FILE]);
      if (hit) {
        st.gistId = hit.id;
        return (await api('GET', `/gists/${hit.id}`)).json();
      }
      if (list.length < 100) break;
    }
    return null;
  }

  // The save in your Gist, or null when there is none yet.
  async function fetchRemote() {
    const gist = await findGist();
    if (!gist) return null;
    const f = gist.files[FILE];
    const text = f.truncated ? await (await api('GET', f.raw_url)).text() : f.content;
    const raw = JSON.parse(text);
    const save = unwrap(text, now());
    return { ...save, machine: raw.machine || { id: null, name: null }, summary: summary(save.pet, save.savedAt) };
  }

  async function push(pet, config) {
    const t = now();
    const content = `${JSON.stringify({ ...wrap(pet, config, t), machine: { id: st.machineId, name: machineName } }, null, 2)}\n`;
    const body = { description: DESCRIPTION, files: { [FILE]: { content } } };
    const gist = st.gistId ? await (await api('PATCH', `/gists/${st.gistId}`, body)).json() : await (await api('POST', '/gists', { ...body, public: false })).json();
    st.gistId = gist.id;
    synced(t);
    return t;
  }

  // Remembers the version both sides now share.
  function synced(savedAt) {
    st.lastSync = savedAt;
    st.dirty = false;
    st.syncedAt = now();
    lastError = null;
    save();
  }

  function markChanged() {
    if (st.dirty) return;
    st.dirty = true;
    save();
  }

  // Decides what to do. fresh: this computer's pet is a new egg.
  async function sync({ pet, config, fresh = false, force = null } = {}) {
    if (!st.login) return { action: 'off' };
    try {
      const remote = await fetchRemote();
      if (!remote) {
        await push(pet, config);
        return { action: 'pushed' };
      }
      const mine = remote.machine.id === st.machineId;
      const elsewhere = !mine && remote.savedAt !== st.lastSync;
      if (force === 'local') {
        await push(pet, config);
        return { action: 'pushed' };
      }
      if (force === 'remote' || (elsewhere && (fresh || (st.lastSync !== null && !st.dirty)))) return { action: 'pull', remote };
      if (elsewhere) return { action: 'conflict', remote };
      if (st.dirty || st.lastSync === null) {
        await push(pet, config);
        return { action: 'pushed' };
      }
      return { action: 'up-to-date' };
    } catch (err) {
      lastError = err.message;
      return { action: 'error', error: err.message };
    }
  }

  function status() {
    return {
      connected: Boolean(st.login),
      login: st.login,
      source: st.source,
      syncedAt: st.syncedAt,
      machine: machineName,
      device: device ? { userCode: device.userCode, uri: device.uri, expiresAt: device.expiresAt } : null,
      canDevice: Boolean(clientId),
      error: lastError,
    };
  }

  save();
  return { connectGh, startDevice, logout, sync, push, synced, markChanged, fetchRemote, status, connected: () => Boolean(st.login) };
}

module.exports = { createCloud, readGhToken, DESCRIPTION, FILE };
