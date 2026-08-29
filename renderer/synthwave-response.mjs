const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));

const smoothstep = (edge0, edge1, value) => {
  const amount = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return amount * amount * (3 - 2 * amount);
};

function foldedTempo(value) {
  let bpm = Math.max(0, Number(value) || 0);
  while (bpm > 180) bpm /= 2;
  while (bpm > 0 && bpm < 70) bpm *= 2;
  return bpm;
}

export function synthwaveAudioResponse(metrics = {}) {
  const bpm = foldedTempo(metrics.bpm || metrics.modelTempoBpm);
  const tempoConfidence = clamp(Math.max(
    clamp(metrics.tempoConfidence),
    clamp(metrics.modelTempoConfidence),
    clamp(metrics.profileConfidence)
  ));
  // The characteristic range is broad because dreamwave and darksynth sit at
  // opposite ends. Tempo is therefore supporting evidence, never a hard gate.
  const tempoAffinity = bpm
    ? smoothstep(68, 82, bpm) * (1 - smoothstep(148, 166, bpm))
    : 0;
  const pulseRegularity = clamp(
    clamp(metrics.regularity) * (0.68 + tempoConfidence * 0.32)
      + tempoAffinity * tempoConfidence * 0.18
  );

  // Repeating low-register synth bass and drum-machine body should move the
  // road. Positive low-band flux is scaled into the same 0..1 domain as the
  // slower band envelopes before the signals are blended.
  const bassFoundation = clamp(
    clamp(metrics.bass) * 0.3
      + clamp(metrics.lowMid) * 0.25
      + clamp(metrics.bassPulse) * 0.3
      + clamp(clamp(metrics.lowFlux) * 8) * 0.15
  );

  // Mid/high pulse and spectral change are a practical real-time proxy for
  // active arpeggios and bright sequenced synth layers. Sustained high-band
  // energy alone is kept weak so broadband noise does not masquerade as motion.
  const arpActivity = clamp(
    clamp(metrics.mid) * 0.23
      + clamp(metrics.high) * 0.1
      + clamp(metrics.midPulse) * 0.3
      + clamp(metrics.highPulse) * 0.12
      + clamp((clamp(metrics.midFlux) * 0.72 + clamp(metrics.highFlux) * 0.28) * 8) * 0.2
      + clamp(metrics.brightness) * 0.05
  );

  const relativeActivity = clamp((Math.max(0, Number(metrics.relativeEnergy) || 0) - 0.72) / 1.06);
  const sectionEnergy = clamp(
    relativeActivity * 0.31
      + clamp(metrics.volume) * 0.13
      + clamp(metrics.drive) * 0.18
      + bassFoundation * 0.21
      + arpActivity * 0.17
  );
  const impact = clamp(Math.max(
    clamp(metrics.rhythmPulse),
    clamp(metrics.impact) * 0.92,
    clamp(metrics.kickPulse) * 0.86
  ));
  const pulseBrightness = clamp(clamp(metrics.midPulse) * 0.55 + clamp(metrics.highPulse) * 0.45);

  return {
    tempoAffinity,
    pulseRegularity,
    bassFoundation,
    arpActivity,
    sectionEnergy,
    impact,
    gridMotion: clamp(
      sectionEnergy * 0.42
        + bassFoundation * 0.26
        + pulseRegularity * 0.2
        + impact * 0.12
    ),
    sunMotion: clamp(
      sectionEnergy * 0.34
        + arpActivity * 0.34
        + pulseRegularity * 0.14
        + impact * 0.18
    ),
    starEnergy: clamp(
      sectionEnergy * 0.48
        + arpActivity * 0.32
        + clamp(metrics.brightness) * 0.1
        + pulseRegularity * 0.1
    ),
    starImpact: clamp(impact * (0.72 + pulseBrightness * 0.28)),
    lineEnergy: clamp(
      sectionEnergy * 0.48
        + bassFoundation * 0.22
        + arpActivity * 0.15
        + pulseRegularity * 0.15
    )
  };
}
