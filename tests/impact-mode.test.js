const test = require('node:test');
const assert = require('node:assert/strict');
test('music response preserves DSP; beat mode rejects extra DSP transients', async () => {
 const {ImpactMode} = await import('../renderer/impact-mode.mjs'); const fx=new ImpactMode();
 const metrics={volume:.2,impact:1,onsetNow:true,bassPulse:.8};
 assert.equal(fx.update(metrics,null,10,'music'),metrics);
 const result=fx.update(metrics,null,20,'beat');assert.equal(result.impact,0);assert.equal(result.onsetNow,false);
});
test('beats fire once with fixed or music-dependent strength and stop in silence', async () => {
 const {ImpactMode} = await import('../renderer/impact-mode.mjs');
 for(const strength of ['fixed','dynamic']) {
 const fx=new ImpactMode();const model={available:true,receivedAt:100,peakSerial:0,peakAt:0};
 fx.update({volume:.2},model,100,'beat',strength);
 const beat={...model,receivedAt:120,peakAt:120,peakSerial:1};
 const result=fx.update({volume:.2},beat,120,'beat',strength);
 assert.equal(result.beatNow,true);assert.ok(result.impact>=.5);
 if(strength==='fixed')assert.equal(result.impact,.78);
 assert.equal(fx.update({volume:.2,impact:1},beat,140,'beat',strength).beatNow,false);
 assert.equal(fx.update({volume:0},beat,160,'beat',strength).impact,0);
 }
});
test('mode changes, stale data, gaps and restarted serials do not replay peaks', async () => {
 const {ImpactMode} = await import('../renderer/impact-mode.mjs');const fx=new ImpactMode();
 const m={available:true,receivedAt:100,peakAt:100,peakSerial:3};
 assert.equal(fx.update({volume:.5},m,100,'beat').beatNow,false);
 assert.equal(fx.update({volume:.5},m,110,'beat','fixed').beatNow,false);
 assert.equal(fx.update({volume:.5},{...m,peakSerial:1},130,'beat','fixed').beatNow,false);
 assert.equal(fx.update({volume:.5},{...m,peakSerial:4},800,'beat','fixed').beatNow,false);
});
