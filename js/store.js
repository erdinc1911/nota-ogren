// İlerleme ve ayarlar (yalnızca bu tarayıcıda saklanır).
const KEY = 'nota-ogren.v3'; // v3: seviyeler her seferinde tek nota olacak şekilde yeniden düzenlendi

function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
let data = load();
data.unlocked ??= 0;          // açık olan en yüksek seviye
data.passed ??= {};
data.best ??= {};
data.miss ??= {};
data.settings ??= { sound: true };

function persist() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} }

export const getUnlocked = () => data.unlocked;
export const isPassed = (id) => !!data.passed[id];
export const getBest = (id) => data.best[id] || 0;
export function pass(id) {
  data.passed[id] = true;
  data.unlocked = Math.max(data.unlocked, id + 1);
  persist();
}
export function unlockAll(max) { data.unlocked = max; persist(); }
export function setBest(id, v) { if (v > (data.best[id] || 0)) { data.best[id] = v; persist(); } }
export const getMiss = (key) => data.miss[key] || 0;
export function recordAnswer(key, ok) {
  data.miss[key] = ok ? Math.max(0, (data.miss[key] || 0) - 1) : (data.miss[key] || 0) + 1;
  persist();
}
export const getSettings = () => data.settings;
export function setSetting(k, v) { data.settings[k] = v; persist(); }
export function resetAll() { data = { unlocked: 0, passed: {}, best: {}, miss: {}, settings: data.settings }; persist(); }
