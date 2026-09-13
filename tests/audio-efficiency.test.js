const test=require('node:test');
const assert=require('node:assert/strict');
const {CausalFeatures,HOP_SIZE,MODEL_INPUTS,LocalRhythmModel}=require('../src/rhythm-model-runtime');

test('reused feature output preserves independent public results and a reset starts cleanly',()=>{
  const hop=Float32Array.from({length:HOP_SIZE},(_,i)=>Math.sin(i*.07));
  const model=new CausalFeatures(),fresh=new CausalFeatures(),scratch=new Float32Array(MODEL_INPUTS);
  const first=model.update(hop),saved=first.slice();
  assert.notEqual(model.update(hop),first);assert.deepEqual(first,saved);
  model.reset();assert.equal(model.update(hop,scratch),scratch);assert.deepEqual(scratch,fresh.update(hop));
});

test('reset and queued capture cannot overwrite an in-flight ONNX feature or recurrent tensor',async()=>{
  let resolveRun,feed;
  const session={run:input=>{feed=input;return new Promise(r=>resolveRun=r);},release:async()=>{}};
  const ort={InferenceSession:{create:async()=>session},Tensor:class{constructor(type,data,dims){Object.assign(this,{type,data,dims});}}};
  const model=new LocalRhythmModel({ort});await model.initialize();
  const hop=Float32Array.from({length:HOP_SIZE},(_,i)=>Math.sin(i*.03));
  for(let i=0;i<5;i++)model.ingest(hop);
  assert.ok(feed);const saved=feed.features.data.slice(),hidden=feed.hidden.data.slice();
  model.reset();for(let i=0;i<3;i++)model.ingest(hop);
  assert.deepEqual(feed.features.data,saved);assert.deepEqual(feed.hidden.data,hidden);
  resolveRun({next_hidden:{data:new Float32Array(300).fill(1)},next_cell:{data:new Float32Array(300)},logits:{data:[0,0,0]}});
  while(model.processing)await new Promise(r=>setTimeout(r,1));
  assert.ok(model.hidden.every(x=>x===0),'A reset must discard the old recurrent result');
  await model.close();
});
