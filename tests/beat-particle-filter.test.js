const test=require('node:test'),assert=require('node:assert/strict');
const {BeatParticleFilter}=require('../src/beat-particle-filter');
function create(seed=1){return new BeatParticleFilter({random:()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}});}
test('causal PF follows 80–180 BPM with narrow peaks and ignores weaker subdivisions',()=>{
 for(const bpm of [80,120,150,180])for(const seed of [1,2,3]){
 const pf=create(seed),hits=[];const period=60000/bpm;
 for(let frame=0;frame<2000;frame++){const t=frame*20;const phase=t%period;const distance=Math.min(phase,period-phase);const activation=Math.max(.02+.93*Math.exp(-.5*(distance/20)**2),Math.abs(phase-period/2)<15?.3:0);if(pf.update(activation,0).trackedBeat&&t>=5000)hits.push(t);}
 const expected=35000/period;assert.ok(Math.abs(hits.length-expected)<3,`${bpm} seed ${seed}: ${hits.length}/${expected}`);
 for(const t of hits){const phase=t%period;assert.ok(Math.min(phase,period-phase)<=60,`off beat ${bpm} ${t}`);}
 }
});
test('no synthetic beat on silence, reset or an evidence-free tail',()=>{
 const pf=create();for(let i=0;i<200;i++)assert.equal(pf.update(0,0).trackedBeat,false);
 for(let i=0;i<300;i++)pf.update(i%25===0?.95:0,0);
 for(let i=0;i<200;i++)assert.equal(pf.update(0,0).trackedBeat,false);
 pf.reset();assert.equal(pf.serial,0);assert.equal(pf.update(0,0).trackedBeat,false);
});
