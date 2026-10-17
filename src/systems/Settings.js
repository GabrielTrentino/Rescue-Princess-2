// Configurações do jogador, salvas no navegador quando possível.
import { MATCH_DEFAULTS } from '../config.js';

const KEY = 'resgate-da-princesa:settings:v1';

export function defaultSettings() {
  return { ...MATCH_DEFAULTS, playerClassId: 'warrior' };
}

export function loadSettings() {
  const defaults = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw);
    const merged = { ...defaults };
    for (const k of Object.keys(defaults)) if (k in saved && typeof saved[k] === typeof defaults[k]) merged[k] = saved[k];
    return merged;
  } catch {
    return defaults;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Armazenamento indisponível (modo privado etc.): as configurações valem só nesta sessão.
  }
}
