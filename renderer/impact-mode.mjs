const clamp = v => Math.max(0, Math.min(1, Number(v) || 0));

export class ImpactMode {
  constructor() { this.key = ''; this.serial = 0; this.at = 0; this.pulse = 0; this.impact = 0; }
  update(metrics, model, now, mode = 'music', strengthMode = 'dynamic') {
    const available = Boolean(model?.available && now - model.receivedAt < 450);
    const key = `${mode}:${strengthMode}:${available}`;
    const serial = Number(model?.peakSerial) || 0;
    const dt = this.at ? now - this.at : 0;
    const reset = key !== this.key || serial < this.serial || dt >= 250 || dt < 0;
    if (reset) { this.pulse = this.impact = 0; this.serial = serial; }
    this.key = key;
    this.at = now;
    const event = !reset && available && serial > this.serial && now - model.peakAt < 190 && metrics.volume > .003;
    this.serial = serial;
    if (mode !== 'beat') return metrics;
    this.pulse *= Math.exp(-Math.max(0, dt) / 145);
    this.impact *= Math.exp(-Math.max(0, dt) / 92);
    const energy = clamp(Math.max((metrics.bassPulse || 0) * .65 + (metrics.drive || 0) * .35,
      ((metrics.midPulse || 0) * .7 + (metrics.highPulse || 0) * .3) * .65, (metrics.volume || 0) * .55));
    const strength = strengthMode === 'fixed' ? .78 : .5 + .5 * Math.sqrt(energy);
    if (event) this.pulse = this.impact = strength;
    if (!available || !(metrics.volume > .003)) this.pulse = this.impact = 0;
    return {...metrics, rhythmNow: event, beatNow: event, kickNow: event, onsetNow: event,
      rhythmStrength: event ? strength : 0, rhythmPulse: this.pulse, impact: this.impact,
      beat: this.pulse, accent: this.impact, kickPulse: this.pulse, modelBeatNow: false, modelDownbeatNow: false};
  }
}
