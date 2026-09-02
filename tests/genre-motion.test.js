const test = require('node:test');
const assert = require('node:assert/strict');

test('major genre particles use different spatial motion languages', async () => {
  const { genreMotionProfile } = await import('../renderer/genre-motion.mjs');
  assert.equal(genreMotionProfile({ mode: 'hardcore' }).flow, 'radial');
  assert.equal(genreMotionProfile({ mode: 'house' }).flow, 'orbit');
  assert.equal(genreMotionProfile({ mode: 'drum-bass' }).flow, 'warp');
  assert.equal(genreMotionProfile({ mode: 'trap' }).flow, 'fall');
  assert.equal(genreMotionProfile({ mode: 'trance' }).flow, 'inward');
  assert.equal(genreMotionProfile({ mode: 'future-bass' }).flow, 'rise');
  assert.equal(genreMotionProfile({ mode: 'latin' }).flow, 'orbit');
});

test('hard families and soft families do not share the same particle material', async () => {
  const { genreMotionProfile, genreParticleCount } = await import('../renderer/genre-motion.mjs');
  assert.equal(genreMotionProfile({ mode: 'metal' }).kind, 'spark');
  assert.equal(genreMotionProfile({ id: 'puzzycore', mode: 'hardcore' }).kind, 'spark');
  assert.equal(genreMotionProfile({ mode: 'hardstyle' }).kind, 'chevron');
  assert.equal(genreMotionProfile({ id: 'industrial-hardcore', mode: 'hardcore' }).kind, 'shard');
  assert.equal(genreMotionProfile({ id: 'rawstyle', mode: 'hardstyle' }).kind, 'chevron');
  assert.equal(genreMotionProfile({ id: 'euphoric-hardstyle', mode: 'hardstyle' }).kind, 'orb');
  assert.ok(
    genreMotionProfile({ id: 'rawstyle', mode: 'hardstyle' }).speed
      > genreMotionProfile({ id: 'euphoric-hardstyle', mode: 'hardstyle' }).speed
  );
  assert.equal(genreMotionProfile({ mode: 'future-bass' }).kind, 'bubble');
  assert.equal(genreMotionProfile({ id: 'happy-hardcore', mode: 'hardcore' }).kind, 'orb');
  assert.equal(genreMotionProfile({ id: 'k-pop', mode: 'pop' }).flow, 'orbit');
  assert.equal(genreMotionProfile({ id: 'k-pop', mode: 'pop' }).kind, 'sparkle');
  assert.equal(genreMotionProfile({ id: 'city-pop', mode: 'j-pop' }).kind, 'mote');
  assert.equal(genreMotionProfile({ id: 'anime', mode: 'j-pop' }).flow, 'radial');
  assert.equal(genreMotionProfile({ id: 'vocaloid', mode: 'j-pop' }).kind, 'bead');
  assert.ok(
    genreMotionProfile({ id: 'anime', mode: 'j-pop' }).speed
      > genreMotionProfile({ id: 'city-pop', mode: 'j-pop' }).speed
  );
  assert.equal(genreMotionProfile({ id: 'phonk', mode: 'phonk' }).kind, 'dust');
  assert.equal(genreMotionProfile({ id: 'drift-phonk', mode: 'phonk' }).kind, 'spark');
  assert.equal(genreMotionProfile({ id: 'uk-garage', mode: 'garage' }).flow, 'lateral');
  assert.equal(genreMotionProfile({ id: 'two-step-garage', mode: 'garage' }).kind, 'bead');
  assert.equal(genreMotionProfile({ id: 'future-garage', mode: 'garage' }).kind, 'mote');
  assert.equal(genreMotionProfile({ id: 'bassline', mode: 'garage' }).kind, 'block');
  assert.equal(genreMotionProfile({ id: 'deep-house', mode: 'house' }).kind, 'mote');
  assert.equal(genreMotionProfile({ id: 'melodic-house', mode: 'house' }).count, 3);
  assert.equal(genreMotionProfile({ id: 'tropical-house', mode: 'house' }).kind, 'bubble');
  assert.equal(genreMotionProfile({ id: 'afro-house', mode: 'house' }).kind, 'bead');
  assert.equal(genreMotionProfile({ id: 'amapiano', mode: 'house' }).kind, 'block');
  assert.equal(genreMotionProfile({ id: 'french-house', mode: 'house' }).kind, 'streak');
  assert.equal(genreMotionProfile({ id: 'disco-house', mode: 'house' }).kind, 'sparkle');
  assert.equal(genreMotionProfile({ id: 'hard-house', mode: 'house' }).flow, 'radial');
  assert.equal(genreMotionProfile({ id: 'acid-house', mode: 'house' }).kind, 'bead');
  assert.equal(genreMotionProfile({ id: 'blues', family: 'blues', mode: 'rnb' }).kind, 'bead');
  assert.equal(genreMotionProfile({ id: 'blues', family: 'blues', mode: 'rnb' }).flow, 'orbit');
  assert.equal(genreMotionProfile({ id: 'liquid-dnb', mode: 'drum-bass' }).kind, 'mote');
  assert.equal(genreMotionProfile({ id: 'dancefloor-dnb', mode: 'drum-bass' }).flow, 'warp');
  assert.equal(genreMotionProfile({ id: 'jump-up-dnb', mode: 'drum-bass' }).kind, 'block');
  assert.equal(genreMotionProfile({ id: 'neurofunk', mode: 'drum-bass' }).kind, 'shard');
  assert.equal(genreMotionProfile({ id: 'drumstep', mode: 'drum-bass' }).kind, 'block');
  assert.equal(genreMotionProfile({ id: 'jungle', mode: 'drum-bass' }).flow, 'lateral');
  assert.equal(genreMotionProfile({ id: 'minimal-techno', mode: 'techno' }).count, 1);
  assert.equal(genreMotionProfile({ id: 'acid-techno', mode: 'techno' }).kind, 'bead');
  assert.equal(genreMotionProfile({ id: 'melodic-techno', mode: 'techno' }).kind, 'mote');
  assert.equal(genreMotionProfile({ id: 'industrial-techno', mode: 'techno' }).kind, 'shard');
  assert.ok(
    genreMotionProfile({ id: 'hard-techno', mode: 'techno' }).speed
      > genreMotionProfile({ id: 'minimal-techno', mode: 'techno' }).speed
  );
  assert.equal(genreMotionProfile({ id: 'psytrance', mode: 'trance' }).kind, 'bead');
  assert.equal(genreMotionProfile({ id: 'uplifting-trance', mode: 'trance' }).kind, 'mote');
  assert.equal(genreMotionProfile({ id: 'tech-trance', mode: 'trance' }).kind, 'square');
  assert.equal(genreMotionProfile({ id: 'hard-trance', mode: 'trance' }).kind, 'streak');
  assert.ok(
    genreMotionProfile({ id: 'hard-trance', mode: 'trance' }).speed
      > genreMotionProfile({ id: 'progressive-trance', mode: 'trance' }).speed
  );
  assert.equal(genreMotionProfile({ id: 'riddim', mode: 'dubstep' }).kind, 'block');
  assert.equal(genreMotionProfile({ id: 'future-riddim', mode: 'dubstep' }).kind, 'bead');
  assert.equal(genreMotionProfile({ id: 'colour-bass', mode: 'dubstep' }).flow, 'orbit');
  assert.equal(genreMotionProfile({ id: 'melodic-dubstep', mode: 'dubstep' }).flow, 'rise');
  assert.equal(genreMotionProfile({ id: 'deathstep', mode: 'dubstep' }).kind, 'shard');
  assert.equal(genreMotionProfile({ id: 'moombahcore', mode: 'dubstep' }).kind, 'triangle');
  assert.ok(
    genreMotionProfile({ id: 'brostep', mode: 'dubstep' }).speed
      > genreMotionProfile({ id: 'riddim', mode: 'dubstep' }).speed
  );
  assert.equal(genreMotionProfile({ id: 'bebop', family: 'jazz', mode: 'rnb' }).kind, 'bead');
  assert.equal(genreMotionProfile({ id: 'bossa-nova', family: 'jazz', mode: 'rnb' }).kind, 'mote');
  assert.ok(
    genreMotionProfile({ id: 'bebop', family: 'jazz', mode: 'rnb' }).speed
      > genreMotionProfile({ id: 'bossa-nova', family: 'jazz', mode: 'rnb' }).speed
  );
  assert.equal(genreMotionProfile({ id: 'baroque', family: 'classical', mode: 'trance' }).kind, 'mote');
  assert.equal(genreMotionProfile({ id: 'modern-classical', family: 'classical', mode: 'trance' }).kind, 'square');
  assert.equal(genreMotionProfile({ id: 'alternative-rnb', family: 'rnb', mode: 'rnb' }).flow, 'lateral');
  assert.equal(genreMotionProfile({ id: 'neo-soul', family: 'rnb', mode: 'rnb' }).kind, 'mote');
  assert.equal(genreMotionProfile({ id: 'new-jack-swing', family: 'rnb', mode: 'rnb' }).kind, 'bead');
  assert.equal(genreMotionProfile({ id: 'gospel', family: 'rnb', mode: 'rnb' }).flow, 'rise');
  assert.ok(
    genreMotionProfile({ id: 'funk', family: 'rnb', mode: 'rnb' }).speed
      > genreMotionProfile({ id: 'soul', family: 'rnb', mode: 'rnb' }).speed
  );
  assert.equal(genreMotionProfile({ id: 'ambient', mode: 'ambient' }).kind, 'mote');
  assert.equal(genreMotionProfile({ id: 'chillout', mode: 'ambient' }).flow, 'rise');
  assert.ok(
    genreMotionProfile({ id: 'downtempo', mode: 'ambient' }).speed
      > genreMotionProfile({ id: 'ambient', mode: 'ambient' }).speed
  );
  assert.equal(genreMotionProfile({ id: 'idm', mode: 'experimental' }).flow, 'orbit');
  assert.equal(genreMotionProfile({ id: 'glitch', mode: 'experimental' }).flow, 'lateral');
  assert.ok(
    genreMotionProfile({ id: 'glitch', mode: 'experimental' }).jitter
      > genreMotionProfile({ id: 'idm', mode: 'experimental' }).jitter
  );
  assert.equal(genreMotionProfile({ id: 'instrumental-hip-hop', mode: 'hip-hop' }).kind, 'block');
  assert.equal(genreMotionProfile({ id: 'lo-fi-hip-hop', mode: 'hip-hop' }).kind, 'dust');
  assert.equal(genreParticleCount({ mode: 'metal' }, 0.2), 0);
  assert.ok(genreParticleCount({ mode: 'metal' }, 0.95) > genreParticleCount({ mode: 'house' }, 0.95));
});

test('impact contours inherit each family directional language', async () => {
  const { genreImpactRadiusRatio } = await import('../renderer/genre-motion.mjs');
  const dubstepSide = genreImpactRadiusRatio({ mode: 'dubstep' }, 0, 1);
  const dubstepTop = genreImpactRadiusRatio({ mode: 'dubstep' }, Math.PI / 2, 1);
  const bassMusicSide = genreImpactRadiusRatio({ id: 'bass-music', mode: 'dubstep' }, 0, 1);
  const bassMusicTop = genreImpactRadiusRatio({ id: 'bass-music', mode: 'dubstep' }, Math.PI / 2, 1);
  const riddimAxis = genreImpactRadiusRatio({ id: 'riddim', mode: 'dubstep' }, 0, 1);
  const riddimDiagonal = genreImpactRadiusRatio({ id: 'riddim', mode: 'dubstep' }, Math.PI / 4, 1);
  const deathstepTooth = genreImpactRadiusRatio({ id: 'deathstep', mode: 'dubstep' }, -0.25 / 14, 1);
  const melodicTooth = genreImpactRadiusRatio({ id: 'melodic-dubstep', mode: 'dubstep' }, -0.25 / 14, 1);
  const trapBottom = genreImpactRadiusRatio({ mode: 'trap' }, Math.PI / 2, 1);
  const trapTop = genreImpactRadiusRatio({ mode: 'trap' }, -Math.PI / 2, 1);
  const tranceSide = genreImpactRadiusRatio({ mode: 'trance' }, 0, 1);
  const tranceTop = genreImpactRadiusRatio({ mode: 'trance' }, Math.PI / 2, 1);
  const houseLobe = genreImpactRadiusRatio({ id: 'house', mode: 'house' }, 0, 1);
  const futureHouseLobe = genreImpactRadiusRatio({ id: 'future-house', mode: 'house' }, 0, 1);
  const futureHouseValley = genreImpactRadiusRatio({ id: 'future-house', mode: 'house' }, Math.PI / 8, 1);
  const bassHouseLobe = genreImpactRadiusRatio({ id: 'bass-house', mode: 'house' }, 0, 1);
  const bassHouseValley = genreImpactRadiusRatio({ id: 'bass-house', mode: 'house' }, Math.PI / 8, 1);
  const bigRoomLobe = genreImpactRadiusRatio({ id: 'big-room-house', mode: 'house' }, 0, 1);
  const bigRoomValley = genreImpactRadiusRatio({ id: 'big-room-house', mode: 'house' }, Math.PI / 8, 1);
  const deepHouseLobe = genreImpactRadiusRatio({ id: 'deep-house', mode: 'house' }, 0.14, 1);
  const hardHouseStrike = genreImpactRadiusRatio({ id: 'hard-house', mode: 'house' }, 0.02, 1);
  const discoMirror = genreImpactRadiusRatio({ id: 'disco-house', mode: 'house' }, 0, 1);
  const discoValley = genreImpactRadiusRatio({ id: 'disco-house', mode: 'house' }, Math.PI / 16, 1);
  const amapianoBottom = genreImpactRadiusRatio({ id: 'amapiano', mode: 'house' }, Math.PI / 2, 1);
  const amapianoTop = genreImpactRadiusRatio({ id: 'amapiano', mode: 'house' }, -Math.PI / 2, 1);
  const kawaiiEar = genreImpactRadiusRatio({ id: 'kawaii-bass', mode: 'kawaii-bass' }, -Math.PI / 2 - 0.72, 1);
  const kawaiiCrown = genreImpactRadiusRatio({ id: 'kawaii-bass', mode: 'kawaii-bass' }, -Math.PI / 2, 1);
  const kawaiiSide = genreImpactRadiusRatio({ id: 'kawaii-bass', mode: 'kawaii-bass' }, 0, 1);
  const phonkBass = genreImpactRadiusRatio({ id: 'phonk', mode: 'phonk' }, Math.PI / 2, 1);
  const phonkTop = genreImpactRadiusRatio({ id: 'phonk', mode: 'phonk' }, -Math.PI / 2, 1);
  const driftBell = genreImpactRadiusRatio({ id: 'drift-phonk', mode: 'phonk' }, 0, 1);
  const phonkBell = genreImpactRadiusRatio({ id: 'phonk', mode: 'phonk' }, 0, 1);
  const ukGaragePocket = genreImpactRadiusRatio({ id: 'uk-garage', mode: 'garage' }, 0, 1);
  const futureGaragePocket = genreImpactRadiusRatio({ id: 'future-garage', mode: 'garage' }, 0, 1);
  const basslinePocket = genreImpactRadiusRatio({ id: 'bassline', mode: 'garage' }, 0, 1);
  const latinBody = genreImpactRadiusRatio({ id: 'latin', mode: 'latin' }, 0, 1);
  const latinHand = genreImpactRadiusRatio({ id: 'latin', mode: 'latin' }, 0.72 / 5, 1);
  const liquidDnbSide = genreImpactRadiusRatio({ id: 'liquid-dnb', mode: 'drum-bass' }, 0, 1);
  const dancefloorGate = genreImpactRadiusRatio({ id: 'dancefloor-dnb', mode: 'drum-bass' }, 0, 1);
  const dancefloorValley = genreImpactRadiusRatio({ id: 'dancefloor-dnb', mode: 'drum-bass' }, Math.PI / 8, 1);
  const jumpUpSide = genreImpactRadiusRatio({ id: 'jump-up-dnb', mode: 'drum-bass' }, 0, 1);
  const jumpUpTop = genreImpactRadiusRatio({ id: 'jump-up-dnb', mode: 'drum-bass' }, Math.PI / 2, 1);
  const jungleBreak = genreImpactRadiusRatio({ id: 'jungle', mode: 'drum-bass' }, 0, 1);
  const jungleGap = genreImpactRadiusRatio({ id: 'jungle', mode: 'drum-bass' }, Math.PI / 4, 1);
  const cityPopLobe = genreImpactRadiusRatio({ id: 'city-pop', mode: 'j-pop' }, 0, 1);
  const animeLaunch = genreImpactRadiusRatio({ id: 'anime', mode: 'j-pop' }, 0, 1);
  const animeValley = genreImpactRadiusRatio({ id: 'anime', mode: 'j-pop' }, Math.PI / 7, 1);
  const vocaloidGate = genreImpactRadiusRatio({ id: 'vocaloid', mode: 'j-pop' }, 0, 1);
  const vocaloidGap = genreImpactRadiusRatio({ id: 'vocaloid', mode: 'j-pop' }, Math.PI / 12, 1);
  assert.ok(dubstepSide > dubstepTop);
  assert.ok(Math.min(bassMusicSide, bassMusicTop) > 1.015);
  assert.ok(Math.abs(bassMusicSide - bassMusicTop) < Math.abs(dubstepSide - dubstepTop));
  assert.ok(riddimAxis > riddimDiagonal);
  assert.ok(deathstepTooth > melodicTooth);
  assert.ok(trapBottom > trapTop);
  assert.ok(tranceSide > tranceTop);
  assert.ok(futureHouseLobe > houseLobe);
  assert.ok(futureHouseLobe > futureHouseValley);
  assert.ok(bassHouseLobe > bassHouseValley);
  assert.ok(bassHouseLobe > houseLobe);
  assert.ok(bigRoomLobe > houseLobe);
  assert.ok(bigRoomLobe > bigRoomValley);
  assert.ok(hardHouseStrike > deepHouseLobe);
  assert.ok(discoMirror > discoValley);
  assert.ok(amapianoBottom > amapianoTop);
  assert.ok(kawaiiEar > kawaiiCrown);
  assert.ok(kawaiiEar > kawaiiSide);
  assert.ok(phonkBass > phonkTop);
  assert.ok(driftBell > phonkBell);
  assert.ok(ukGaragePocket > 1);
  assert.ok(basslinePocket > ukGaragePocket);
  assert.ok(ukGaragePocket > futureGaragePocket);
  assert.ok(latinBody > 1.008);
  assert.notEqual(latinBody, latinHand);
  assert.ok(dancefloorGate > dancefloorValley);
  assert.ok(jumpUpSide > jumpUpTop);
  assert.ok(jumpUpSide > liquidDnbSide);
  assert.ok(jungleBreak > jungleGap);
  assert.ok(cityPopLobe > 1);
  assert.ok(animeLaunch > animeValley);
  assert.ok(vocaloidGate > vocaloidGap);
  assert.ok(animeLaunch > cityPopLobe);
});
