// Sprites guiados por manifestos (assets/manifests/*.json).
// Personagens: cada classe tem animações (idle, run, attack, hurt, death) em folhas por equipe:
// colunas = quadros, linhas = direções. O caminho pode conter {team}, trocado por blue/red.
// Enquanto uma classe estiver como "placeholder" ou com arquivos ausentes, o renderizador usa a
// arte provisória. A colisão nunca depende destes dados.

export const DIRECTIONS_4 = ['down', 'left', 'right', 'up'];
export const TEAM_IDS = ['blue', 'red'];

export function directionFromAngle(angle) {
  const a = Math.atan2(Math.sin(angle), Math.cos(angle));
  if (a > -Math.PI / 4 && a <= Math.PI / 4) return 'right';
  if (a > Math.PI / 4 && a <= (3 * Math.PI) / 4) return 'down';
  if (a <= -Math.PI / 4 && a > (-3 * Math.PI) / 4) return 'up';
  return 'left';
}

// Lista todos os arquivos de um manifesto de personagens (com {team} expandido).
export function manifestFiles(manifest, onlyReady = true) {
  const files = [];
  for (const entry of Object.values(manifest.characters ?? {})) {
    if (onlyReady && entry.status !== 'ready') continue;
    for (const anim of Object.values(entry.animations ?? {})) {
      if (anim.src.includes('{team}')) TEAM_IDS.forEach((t) => files.push(anim.src.replaceAll('{team}', t)));
      else files.push(anim.src);
    }
  }
  for (const prop of Object.values(manifest.props ?? {})) files.push(prop.src);
  return files;
}

// Valida a estrutura de um manifesto. Retorna a lista de problemas encontrados.
export function validateManifest(manifest) {
  const problems = [];
  if (!manifest || typeof manifest !== 'object') return ['manifesto ausente'];
  const defaults = manifest.defaults ?? {};
  for (const [classId, entry] of Object.entries(manifest.characters ?? {})) {
    if (!['placeholder', 'ready'].includes(entry.status)) problems.push(`${classId}: status inválido`);
    for (const [name, anim] of Object.entries(entry.animations ?? {})) {
      const spec = { ...defaults, ...anim };
      if (!spec.src) problems.push(`${classId}.${name}: src ausente`);
      if (!(spec.frames > 0)) problems.push(`${classId}.${name}: frames inválido`);
      if (!(spec.fps > 0)) problems.push(`${classId}.${name}: fps inválido`);
      if (!(spec.frameWidth > 0 && spec.frameHeight > 0)) problems.push(`${classId}.${name}: dimensões inválidas`);
    }
  }
  for (const [name, prop] of Object.entries(manifest.props ?? {})) {
    const spec = { ...defaults, ...prop };
    if (!spec.src) problems.push(`${name}: src ausente`);
    if (!(spec.scale > 0)) problems.push(`${name}: escala inválida`);
  }
  return problems;
}

export class SpriteManager {
  constructor() {
    this.sheets = new Map(); // `${classId}:${team}:${anim}` -> { img, spec }
    this.ready = new Set();  // classes com todas as folhas carregadas
    this.props = new Map();  // nome -> { img, spec }
    this.listeners = [];
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  async load(characterUrl, environmentUrl) {
    await Promise.all([this.loadCharacters(characterUrl), environmentUrl ? this.loadProps(environmentUrl) : null]);
    this.listeners.forEach((fn) => fn());
  }

  async loadCharacters(url) {
    const manifest = await fetchJson(url);
    if (!manifest) return;
    const problems = validateManifest(manifest);
    if (problems.length) console.warn('[sprites] problemas no manifesto:', problems);
    const defaults = manifest.defaults ?? {};
    const jobs = [];
    for (const [classId, entry] of Object.entries(manifest.characters ?? {})) {
      if (entry.status !== 'ready') continue;
      const loads = [];
      for (const [name, anim] of Object.entries(entry.animations ?? {})) {
        const spec = { ...defaults, ...anim };
        for (const team of TEAM_IDS) {
          const src = spec.src.replaceAll('{team}', team);
          loads.push(loadImage(src).then((img) => this.sheets.set(`${classId}:${team}:${name}`, { img, spec })));
        }
      }
      jobs.push(
        Promise.all(loads)
          .then(() => this.ready.add(classId))
          .catch((err) => console.warn(`[sprites] ${classId}: usando arte provisória (${err.message})`)),
      );
    }
    await Promise.all(jobs);
  }

  async loadProps(url) {
    const manifest = await fetchJson(url);
    if (!manifest) return;
    const defaults = manifest.defaults ?? {};
    await Promise.all(Object.entries(manifest.props ?? {}).map(([name, prop]) => {
      const spec = { ...defaults, ...prop };
      return loadImage(spec.src)
        .then((img) => this.props.set(name, { img, spec }))
        .catch((err) => console.warn(`[sprites] objeto ${name} indisponível (${err.message})`));
    }));
  }

  hasSprites(classId) {
    return this.ready.has(classId);
  }

  prop(name) {
    return this.props.get(name) ?? null;
  }

  // Parâmetros de desenho do quadro atual, ou null se a classe não tem sprites.
  frame(classId, team, animName, elapsed, facing) {
    if (!this.ready.has(classId)) return null;
    const sheet = this.sheets.get(`${classId}:${team}:${animName}`) ?? this.sheets.get(`${classId}:${team}:idle`);
    if (!sheet) return null;
    const { img, spec } = sheet;
    const raw = Math.floor(elapsed * spec.fps);
    const index = spec.loop === false ? Math.min(raw, spec.frames - 1) : raw % spec.frames;
    const dirs = spec.directions ?? DIRECTIONS_4;
    let dir = directionFromAngle(facing);
    let flip = false;
    if (!dirs.includes(dir) && dir === 'left' && dirs.includes('right') && spec.mirror) {
      dir = 'right';
      flip = true;
    }
    const row = Math.max(0, dirs.indexOf(dir));
    return {
      img,
      sx: index * spec.frameWidth,
      sy: row * spec.frameHeight,
      sw: spec.frameWidth,
      sh: spec.frameHeight,
      ox: spec.originX ?? spec.frameWidth / 2,
      oy: spec.originY ?? spec.frameHeight,
      scale: spec.scale ?? 1,
      flip,
    };
  }
}

async function fetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.info(`[sprites] ${url} indisponível, usando arte provisória:`, err.message);
    return null;
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`não foi possível carregar ${src}`));
    img.src = src;
  });
}
