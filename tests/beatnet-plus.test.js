const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {CausalFeatures,LocalRhythmModel,RHYTHM_PROFILES}=require('../src/rhythm-model-runtime');
test('BeatNet+ streaming features match independent centered-window NumPy reference',()=>{
 const fixture=require('./fixtures/beatnet-plus-features.json'),features=new CausalFeatures(RHYTHM_PROFILES['beatnet-plus']);
 for(let step=0;step<10;step++){
  const signal=Float32Array.from({length:441},(_,i)=>{const t=(step*441+i)/22050;return .6*Math.sin(2*Math.PI*110*t)+.15*Math.sin(2*Math.PI*1700*t);});
  const actual=features.update(signal);assert.equal(actual.length,288);
  for(let i=0;i<288;i++)assert.ok(Math.abs(actual[i]-fixture[step][i])<2e-6,`${step}:${i}: ${actual[i]} vs ${fixture[step][i]}`);
 }
});
test('original BeatNet feature regression remains unchanged',()=>{
 const features=new CausalFeatures();let frame;
 for(let h=0;h<20;h++)frame=features.update(Float32Array.from({length:441},(_,i)=>Math.sin(2*Math.PI*110*(h*441+i)/22050)));
 assert.ok(Math.abs(frame[0]-.07744191586971283)<5e-7);
 assert.ok(Math.abs(frame.reduce((a,b)=>a+b,0)-8.8283109664917)<2e-6);
});
const modelPath=path.resolve('assets/models/beatnet-plus/generic_weights.onnx');

test('silent audio suppresses recurrent beat hallucinations and live input resumes immediately',async()=>{
 const events=[];let now=0;
 const session={run:async()=>({logits:{data:[10,0,0]},next_hidden:{data:new Float32Array(600)},next_cell:{data:new Float32Array(600)}})};
 const ort={Tensor:class{},InferenceSession:{create:async()=>session}};
 const model=new LocalRhythmModel({modelPath:'mock',modelKind:'beatnet-plus',ort,now:()=>now,onEvent:e=>events.push(e)});
 try{
  await model.initialize();
  const feed=async(value)=>{now+=20;model.ingest(new Float32Array(441).fill(value));while(model.processing||model.queue.length)await new Promise(r=>setImmediate(r));};
  for(let i=0;i<10;i++)await feed(.1);
  for(let i=0;i<5;i++)await feed(0);
  events.length=0;
  for(let i=0;i<20;i++)await feed(0);
  assert.ok(events.some(e=>e.type==='rhythm'));
  assert.ok(events.every(e=>!e.trackedBeat&&e.beat===0));
  assert.equal(model.silentFrames,25);
  for(let i=0;i<5;i++)await feed(.1);
  assert.equal(model.silentFrames,0);
  assert.ok(events.some(e=>e.beat>.9));
  model.reset();assert.equal(model.silentFrames,0);
 }finally{await model.close();}
});
test('BeatNet+ ONNX streams with four recurrent layers, reset and silence', async()=>{
 const events=[];let now=0;
 const model=new LocalRhythmModel({modelPath,modelKind:'beatnet-plus',now:()=>now,onEvent:e=>events.push(e)});
 try{
  assert.equal(await model.initialize(),true);
  for(let i=0;i<160;i++){now=i*20;model.ingest(new Float32Array(441));while(model.processing||model.queue.length)await new Promise(r=>setImmediate(r));}
  assert.equal(model.beatTracker.edmTiming,'boundary');assert.equal(model.hidden.length,600);assert.ok(events.some(e=>e.type==='rhythm'));
  assert.ok(events.every(e=>!e.trackedBeat));
  assert.ok(events.every(e=>e.type!=='unavailable'));
  model.reset();assert.ok(model.hidden.every(v=>v===0));assert.equal(model.beatTracker.serial,0);
 }finally{await model.close();}
});
