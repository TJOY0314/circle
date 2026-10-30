import { safeColor } from './color.js';

export function normalizeProfile(profile, user = {}) {
  const fallback = user.displayName || user.email?.split('@')[0] || '사용자';
  const nickname = (typeof profile?.nickname === 'string' ? profile.nickname : fallback).trim().slice(0, 30) || '사용자';
  return { nickname, color: safeColor(profile?.color, '#32664e') };
}

export function activeParticipants(sessions, now = Date.now()) {
  const users = new Map();
  for (const session of sessions) {
    const time = typeof session.lastSeen?.toMillis === 'function' ? session.lastSeen.toMillis() : session.lastSeen;
    if (!session.uid || !Number.isFinite(time) || now - time >= 90000 || time - now > 30000) continue;
    if ((users.get(session.uid)?.time || 0) > time) continue;
    users.set(session.uid, { uid: session.uid, ...normalizeProfile(session), time });
  }
  return [...users.values()].sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'));
}

// Each tab/device owns its own session. Closing one never removes another's entry.
export function createPresenceSession({ store, projectId, uid, profile, onChange, onError,
  now = Date.now, every = setInterval, cancel = clearInterval, sessionId = crypto.randomUUID() }) {
  let sessions = [], active = true, stopped = false, state = 'connecting', inFlight = false;
  let chain = Promise.resolve(), lastError = false;
  const render = () => { if (stopped) return; onChange({ state: active ? state : 'connecting', participants: state === 'live' && active ? activeParticipants(sessions, now()) : [] }); };
  const failure = error => { if (stopped) return; state = 'error'; render(); if (!lastError) onError?.(error); lastError = true; };
  function beat() {
    if (stopped || !active || inFlight) return;
    inFlight = true;
    chain = chain.then(() => {
      if (!stopped && active) return store.heartbeatPresence(projectId, sessionId, { uid, ...profile() });
    }).catch(failure).finally(() => { inFlight = false; });
  }
  function leave() {
    chain = chain.then(() => store.leavePresence(projectId, sessionId)).catch(failure);
  }
  function refresh() {
    if (inFlight) chain.then(beat); else beat();
  }
  const unsubscribe = store.watchPresence(projectId, (rows, fromCache = false) => {
    if (stopped) return;
    sessions = rows;
    state = fromCache ? 'connecting' : 'live';
    lastError = false;
    render();
  }, failure);
  const timer = every(() => { render(); beat(); }, 25000);
  beat();
  return {
    refresh,
    setActive(value) {
      if (stopped || active === value) return;
      active = value;
      if (active) refresh(); else leave();
      render();
    },
    stop() { if (stopped) return; stopped = true; cancel(timer); unsubscribe(); leave(); },
    settled: () => chain,
  };
}
