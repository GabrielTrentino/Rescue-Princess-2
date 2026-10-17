// Objetivo de captura e defesa: cada equipe tem uma base. Atacantes dentro da base adversária,
// em maior número que os defensores, aumentam o progresso de conquista; defensores o revertem.
// Implementado como sistema independente para que outros modos (ex.: resgate) possam substituí-lo.
import { dist } from '../core/math.js';
import { TEAMS, otherTeam } from '../config.js';

export class CaptureObjective {
  constructor(world) {
    this.world = world;
    this.captureTime = world.config.captureTime;
    this.bases = {};
    for (const team of [TEAMS.BLUE, TEAMS.RED]) {
      const b = world.map.bases[team];
      this.bases[team] = { team, x: b.x, y: b.y, radius: b.radius, name: b.name, progress: 0, attackers: 0, defenders: 0, contested: false, alertCooldown: 0 };
    }
    this.winner = null;
  }

  update(dt) {
    const world = this.world;
    for (const base of Object.values(this.bases)) {
      let attackers = 0;
      let defenders = 0;
      const attackersList = [];
      for (const c of world.characters) {
        if (!c.alive || dist(c.pos, base) > base.radius) continue;
        if (c.team === base.team) defenders++;
        else {
          attackers++;
          attackersList.push(c);
        }
      }
      const wasCapturing = base.attackers > base.defenders;
      base.attackers = attackers;
      base.defenders = defenders;
      base.contested = attackers > 0 && defenders > 0;
      base.alertCooldown = Math.max(0, base.alertCooldown - dt);

      // Vantagem numérica conquista: atacantes em maior número avançam, mesmo com defensores presentes.
      const advantage = attackers - defenders;
      if (advantage > 0) {
        const rate = (1 + 0.25 * (Math.min(advantage, 4) - 1)) / this.captureTime;
        base.progress += rate * dt;
        for (const c of attackersList) c.stats.captureTime += dt;
        if (!wasCapturing && base.alertCooldown === 0) {
          base.alertCooldown = 8;
          world.events.emit('objective', { type: 'underAttack', team: base.team });
        }
      } else if (attackers === 0 || advantage < 0) {
        base.progress -= (defenders > 0 ? 0.6 : 0.15) / this.captureTime * dt;
      }
      base.progress = Math.min(1, Math.max(0, base.progress));
      if (base.progress >= 1 && !this.winner) {
        this.winner = otherTeam(base.team);
        world.events.emit('objective', { type: 'captured', team: base.team, by: this.winner });
      }
    }
    return this.winner;
  }

  // Ao fim do tempo: vence quem avançou mais na base adversária; depois, quem eliminou mais.
  decideOnTimeout({ tiebreakKills = true } = {}) {
    const blueAdvance = this.bases.red.progress;
    const redAdvance = this.bases.blue.progress;
    if (Math.abs(blueAdvance - redAdvance) > 0.01) return blueAdvance > redAdvance ? TEAMS.BLUE : TEAMS.RED;
    if (!tiebreakKills) return null;
    const kills = (team) => this.world.characters.filter((c) => c.team === team).reduce((s, c) => s + c.stats.kills, 0);
    const kb = kills(TEAMS.BLUE);
    const kr = kills(TEAMS.RED);
    if (kb === kr) return null;
    return kb > kr ? TEAMS.BLUE : TEAMS.RED;
  }

  status() {
    return this.bases;
  }
}
