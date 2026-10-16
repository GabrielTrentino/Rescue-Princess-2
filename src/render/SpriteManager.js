// Sprites guiados por manifesto (assets/manifests/characters.json).
// Cada classe tem animações (idle, run, attack, hurt, death) em folhas: colunas = quadros,
// linhas = direções. Enquanto uma classe estiver como "placeholder" ou com arquivos ausentes,
// o renderizador usa a arte provisória. A colisão nunca depende destes dados.

export const DIRECTIONS_4 = ['down', 'left', 'right', 'up'];

export function directionFromAngle(angle) {
  const a = Math.atan2(Math.sin(angle), Math.cos(angle));
  if (a > -Math.PI / 4 && a <= Math.PI / 4) return 'right';
  if (a > Math.PI / 4 && a <= (3 * Math.PI) / 4) return 'down';
  if (a <= -Math.PI / 4 && a > (-3 * Math.PI) / 4) return 'up';
  return 'left';
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
  return problems;
}

export class SpriteManager {
  constructor() {
    this.manifest = null;
    this.sheets = new Map(); // `${classId}:${anim}` -> { img, spec }
    this.ready = new Set();  // classes com todas as folhas carregadas
  }

  async load(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.manifest = await res.json();
    } catch (err) {
      console.info('[sprites] manifesto indisponível, usando arte provisória:', err.message);
      return;
    }
    const problems = validateManifest(this.manifest);
    if (problems.length) console.warn('[sprites] problemas no manifesto:', problems);
    const defaults = this.manifest.defaults ?? {};
    const jobs = [];
    for (const [classId, entry] of Object.entries(this.manifest.characters ?? {})) {
      if (entry.status !== 'ready') continue;
      const loads = Object.entries(entry.animations ?? {}).map(([name, anim]) => {
        const spec = { ...defaults, ...anim };
        return loadImage(spec.src).then((img) => this.sheets.set(`${classId}:${name}`, { img, spec }));
      });
      jobs.push(
        Promise.all(loads)
          .then(() => this.ready.add(classId))
          .catch((err) => console.warn(`[sprites] ${classId}: usando arte provisória (${err.message})`)),
      );
    }
    await Promise.all(jobs);
  }

  hasSprites(classId) {
    return this.ready.has(classId);
  }

  // Parâmetros de desenho do quadro atual, ou null se a classe não tem sprites.
  frame(classId, animName, elapsed, facing) {
    if (!this.ready.has(classId)) return null;
    const sheet = this.sheets.get(`${classId}:${animName}`) ?? this.sheets.get(`${classId}:idle`);
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

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`não foi possível carregar ${src}`));
    img.src = src;
  });
}
