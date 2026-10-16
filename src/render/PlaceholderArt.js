// Arte provisória desenhada por código: personagens "chibi" (cabeça grande, arma bem visível,
// silhueta própria por classe). Será substituída por sprites renderizados a partir de modelos 3D
// assim que existirem arquivos no manifesto (assets/manifests/characters.json).
import { CLASS_LOOK, OUTLINE, SKIN, TEAM_COLORS } from './palette.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fillStroke(ctx, fill, lw = 2) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

// Desenha a arma no sistema de coordenadas da mão (eixo +x = direção da mira).
function drawWeapon(ctx, classId, u, swing, team) {
  ctx.save();
  ctx.rotate(swing);
  ctx.lineJoin = 'round';
  switch (classId) {
    case 'warrior': {
      roundRect(ctx, u * 0.2, -u * 0.12, u * 1.5, u * 0.24, u * 0.08);
      fillStroke(ctx, '#e8eef5');
      roundRect(ctx, u * 0.05, -u * 0.35, u * 0.18, u * 0.7, u * 0.06);
      fillStroke(ctx, '#b58b3c');
      break;
    }
    case 'barbarian': {
      roundRect(ctx, -u * 0.2, -u * 0.09, u * 1.6, u * 0.18, u * 0.06);
      fillStroke(ctx, '#7a4b28');
      ctx.beginPath();
      ctx.moveTo(u * 1.05, -u * 0.1);
      ctx.quadraticCurveTo(u * 1.35, -u * 0.95, u * 1.55, -u * 0.55);
      ctx.lineTo(u * 1.55, u * 0.55);
      ctx.quadraticCurveTo(u * 1.35, u * 0.95, u * 1.05, u * 0.1);
      ctx.closePath();
      fillStroke(ctx, '#d9dee6');
      break;
    }
    case 'mage': {
      roundRect(ctx, -u * 0.3, -u * 0.08, u * 1.9, u * 0.16, u * 0.06);
      fillStroke(ctx, '#6b4a2b');
      ctx.beginPath();
      ctx.arc(u * 1.7, 0, u * 0.32, 0, Math.PI * 2);
      ctx.shadowColor = '#c9a6ff';
      ctx.shadowBlur = 12;
      fillStroke(ctx, '#d8c2ff');
      ctx.shadowBlur = 0;
      break;
    }
    case 'archer': {
      ctx.beginPath();
      ctx.arc(u * 0.35, 0, u * 0.95, -1.25, 1.25);
      ctx.lineWidth = u * 0.22;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.lineWidth = u * 0.12;
      ctx.strokeStyle = '#a8743f';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(u * 0.35 + Math.cos(-1.25) * u * 0.95, Math.sin(-1.25) * u * 0.95);
      ctx.lineTo(u * 0.35 + Math.cos(1.25) * u * 0.95, Math.sin(1.25) * u * 0.95);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#f5f0e0';
      ctx.stroke();
      break;
    }
    case 'mercenary': {
      for (const off of [-0.35, 0.35]) {
        ctx.beginPath();
        ctx.moveTo(u * 0.2, off * u);
        ctx.lineTo(u * 1.05, off * u * 0.6);
        ctx.lineTo(u * 0.2, off * u + u * 0.12);
        ctx.closePath();
        fillStroke(ctx, '#e3e7ef', 1.5);
      }
      break;
    }
    case 'halberdier': {
      roundRect(ctx, -u * 0.8, -u * 0.07, u * 3.0, u * 0.14, u * 0.05);
      fillStroke(ctx, '#7a5530');
      ctx.beginPath();
      ctx.moveTo(u * 1.9, -u * 0.08);
      ctx.lineTo(u * 2.0, -u * 0.6);
      ctx.quadraticCurveTo(u * 2.4, -u * 0.4, u * 2.3, -u * 0.08);
      ctx.closePath();
      fillStroke(ctx, '#d9dee6', 1.5);
      ctx.beginPath();
      ctx.moveTo(u * 2.2, -u * 0.12);
      ctx.lineTo(u * 2.6, 0);
      ctx.lineTo(u * 2.2, u * 0.12);
      ctx.closePath();
      fillStroke(ctx, '#d9dee6', 1.5);
      break;
    }
    default:
      break;
  }
  ctx.restore();
  if (classId === 'warrior') {
    // Escudo do lado oposto
    ctx.save();
    ctx.translate(-u * 0.1, u * 0.55);
    ctx.beginPath();
    ctx.ellipse(0, 0, u * 0.42, u * 0.5, 0, 0, Math.PI * 2);
    fillStroke(ctx, TEAM_COLORS[team].main);
    ctx.beginPath();
    ctx.ellipse(0, 0, u * 0.18, u * 0.22, 0, 0, Math.PI * 2);
    fillStroke(ctx, '#f2d27a', 1.5);
    ctx.restore();
  }
}

function drawHeadgear(ctx, classId, hx, hy, r, look, team) {
  ctx.lineJoin = 'round';
  switch (classId) {
    case 'warrior':
      ctx.beginPath();
      ctx.arc(hx, hy - r * 0.1, r * 1.02, Math.PI, 0);
      ctx.closePath();
      fillStroke(ctx, look.accent);
      ctx.beginPath();
      ctx.ellipse(hx, hy - r * 1.25, r * 0.22, r * 0.4, 0, 0, Math.PI * 2);
      fillStroke(ctx, TEAM_COLORS[team].main, 1.5);
      break;
    case 'barbarian':
      ctx.beginPath();
      ctx.arc(hx, hy - r * 0.15, r * 1.0, Math.PI, 0);
      ctx.closePath();
      fillStroke(ctx, '#9a9fa8');
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(hx + s * r * 0.75, hy - r * 0.55);
        ctx.quadraticCurveTo(hx + s * r * 1.6, hy - r * 0.9, hx + s * r * 1.35, hy - r * 1.7);
        ctx.quadraticCurveTo(hx + s * r * 1.2, hy - r * 1.0, hx + s * r * 0.55, hy - r * 0.85);
        ctx.closePath();
        fillStroke(ctx, '#f4ead2', 1.5);
      }
      break;
    case 'mage':
      ctx.beginPath();
      ctx.moveTo(hx - r * 1.25, hy - r * 0.35);
      ctx.lineTo(hx + r * 1.25, hy - r * 0.35);
      ctx.lineTo(hx + r * 0.25, hy - r * 2.3);
      ctx.closePath();
      fillStroke(ctx, look.accent);
      ctx.beginPath();
      ctx.arc(hx + r * 0.25, hy - r * 2.3, r * 0.18, 0, Math.PI * 2);
      fillStroke(ctx, '#ffe27a', 1.2);
      break;
    case 'archer':
      ctx.beginPath();
      ctx.arc(hx, hy, r * 1.08, Math.PI * 0.95, Math.PI * 0.05);
      ctx.lineTo(hx + r * 0.2, hy - r * 1.6);
      ctx.closePath();
      fillStroke(ctx, look.accent);
      break;
    case 'mercenary':
      ctx.beginPath();
      ctx.arc(hx, hy - r * 0.05, r * 1.02, Math.PI, 0);
      ctx.closePath();
      fillStroke(ctx, look.accent);
      roundRect(ctx, hx - r * 0.95, hy + r * 0.15, r * 1.9, r * 0.45, r * 0.2);
      fillStroke(ctx, look.accent, 1.5);
      break;
    case 'halberdier':
      ctx.beginPath();
      ctx.ellipse(hx, hy - r * 0.45, r * 1.45, r * 0.35, 0, 0, Math.PI * 2);
      fillStroke(ctx, look.accent);
      ctx.beginPath();
      ctx.arc(hx, hy - r * 0.45, r * 0.85, Math.PI, 0);
      ctx.closePath();
      fillStroke(ctx, look.trim);
      break;
    default:
      break;
  }
}

/**
 * Desenha um personagem provisório com os pés em (sx, sy) na tela.
 * anim: { name: 'idle'|'run'|'attack'|'hurt', time, progress }
 */
export function drawPlaceholderCharacter(ctx, c, sx, sy, scale, anim) {
  const look = CLASS_LOOK[c.classId];
  const team = TEAM_COLORS[c.team];
  const u = c.radius * scale;
  const bulk = c.classId === 'barbarian' ? 1.18 : c.classId === 'mercenary' ? 0.9 : 1;
  const t = anim.time;
  const bob = anim.name === 'run' ? Math.abs(Math.sin(t * 12)) * -u * 0.18 : Math.sin(t * 3) * u * 0.04;
  const cos = Math.cos(c.facing);
  const sin = Math.sin(c.facing);
  const backView = sin < -0.45;
  const handX = sx + cos * u * 0.75;
  const handY = sy - u * 1.15 + bob + sin * u * 0.35;
  const swing = anim.name === 'attack' ? Math.sin(anim.progress * Math.PI) * 1.4 - 0.7 : 0;

  // Sombra e anel de equipe (legibilidade em combates cheios)
  ctx.beginPath();
  ctx.ellipse(sx, sy, u * 1.15, u * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = team.main;
  ctx.stroke();

  const weapon = () => {
    ctx.save();
    ctx.translate(handX, handY);
    ctx.scale(1, 0.85);
    ctx.rotate(c.facing);
    drawWeapon(ctx, c.classId, u, swing, c.team);
    ctx.restore();
  };

  if (backView) weapon();

  // Pernas
  const step = anim.name === 'run' ? Math.sin(t * 12) * u * 0.25 : 0;
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(sx - u * 0.45, sy - u * 0.55 + step * 0.3, u * 0.32, u * 0.55 - step * 0.3);
  ctx.fillRect(sx + u * 0.13, sy - u * 0.55 - step * 0.3, u * 0.32, u * 0.55 + step * 0.3);

  // Corpo / túnica
  const bw = u * 1.55 * bulk;
  const bh = u * 1.25;
  const by = sy - u * 0.5 - bh + bob;
  if (c.classId === 'mage') {
    ctx.beginPath();
    ctx.moveTo(sx - bw * 0.42, by + u * 0.1);
    ctx.lineTo(sx + bw * 0.42, by + u * 0.1);
    ctx.lineTo(sx + bw * 0.62, sy - u * 0.1);
    ctx.lineTo(sx - bw * 0.62, sy - u * 0.1);
    ctx.closePath();
    fillStroke(ctx, look.accent);
    roundRect(ctx, sx - bw * 0.15, by + u * 0.1, bw * 0.3, bh * 1.1, u * 0.1);
    fillStroke(ctx, team.main, 1.5);
  } else {
    roundRect(ctx, sx - bw / 2, by, bw, bh, u * 0.35);
    fillStroke(ctx, team.main);
    // Detalhe de classe sobre o corpo
    ctx.save();
    roundRect(ctx, sx - bw / 2, by, bw, bh, u * 0.35);
    ctx.clip();
    ctx.fillStyle = look.accent;
    if (c.classId === 'warrior' || c.classId === 'halberdier') ctx.fillRect(sx - bw * 0.3, by, bw * 0.6, bh * 0.65);
    else if (c.classId === 'barbarian') ctx.fillRect(sx - bw / 2, by, bw, bh * 0.3);
    else if (c.classId === 'archer') ctx.fillRect(sx - bw / 2, by + bh * 0.45, bw, bh * 0.18);
    else if (c.classId === 'mercenary') {
      ctx.beginPath();
      ctx.moveTo(sx - bw / 2, by);
      ctx.lineTo(sx + bw / 2, by + bh);
      ctx.lineTo(sx + bw / 2 - u * 0.35, by + bh);
      ctx.lineTo(sx - bw / 2, by + u * 0.35);
      ctx.fill();
    }
    ctx.restore();
    roundRect(ctx, sx - bw / 2, by, bw, bh, u * 0.35);
    ctx.lineWidth = 2;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }
  if (c.classId === 'archer') {
    // Aljava
    roundRect(ctx, sx - bw * 0.62, by - u * 0.1, u * 0.35, bh * 0.85, u * 0.1);
    fillStroke(ctx, '#8a5a33', 1.5);
  }

  // Cabeça grande
  const r = u * 0.82;
  const hx = sx + cos * u * 0.05;
  const hy = by - r * 0.75;
  ctx.beginPath();
  ctx.arc(hx, hy, r, 0, Math.PI * 2);
  fillStroke(ctx, SKIN);
  if (!backView) {
    ctx.fillStyle = OUTLINE;
    const ex = cos * r * 0.35;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(hx + ex + s * r * 0.3, hy + r * 0.12, r * 0.1, r * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  drawHeadgear(ctx, c.classId, hx, hy, r, look, c.team);

  if (!backView) weapon();
}
