// Compare optimized DSP with the prior release, using synthetic audio only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Module=require('node:module');
const {execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'output/audio-efficiency');
const baseline=process.argv.find(a=>a.startsWith('--baseline='))?.slice(11)||'99b9ee8';
function prior(file){
  const source=execFileSync('git',['show',`${baseline}:src/${file}`],{cwd:ROOT,encoding:'utf8'});
  const filename=path.join(ROOT,'src','qa-reference-'+file),mod=new Module(filename,module);
  mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod._compile(source,filename);return mod.exports;
}
const oldRhythm=prior('rhythm-model-runtime.js'),oldGenre=prior('audio-genre-model.js');
const rhythm=require('../src/rhythm-model-runtime'),genre=require('../src/audio-genre-model');
const classes=require('../assets/models/discogs-effnet-bsdynamic-1.json').classes;
let seed=21831;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const hops=Array.from({length:240},(_,at)=>Float32Array.from({length:441},(_,i)=>at%43===0?0:(random()-.5)*.1+.3*Math.sin(2*Math.PI*(80+at*7)*(at*441+i)/22050)));
const scores=Array.from({length:100},(_,i)=>Float32Array.from({length:400},()=>i===0?0:i===1?1:random()**8));
function measure(run){for(let i=0;i<3;i++)run();const samples=[];for(let i=0;i<7;i++){const at=performance.now();run();samples.push(performance.now()-at);}return samples.sort((a,b)=>a-b)[3];}
(async()=>{
 fs.mkdirSync(OUT,{recursive:true});
 const a=new oldRhythm.CausalFeatures(),b=new rhythm.CausalFeatures(),scratch=new Float32Array(rhythm.MODEL_INPUTS);
 for(const hop of hops)assert.deepEqual(b.update(hop,scratch),a.update(hop));
 b.reset();const fresh=new oldRhythm.CausalFeatures();for(const hop of hops.slice(0,25))assert.deepEqual(b.update(hop,scratch),fresh.update(hop));
 for(const score of scores)assert.deepEqual(genre.aggregateGenreScores(score,classes),oldGenre.aggregateGenreScores(score,classes));
 const featureRun=Type=>{const f=new Type.CausalFeatures();return ()=>{for(const hop of hops)f.update(hop,scratch);};};
 const timings={rhythmBeforeMs:measure(featureRun(oldRhythm)),rhythmAfterMs:measure(featureRun(rhythm)),genreBeforeMs:measure(()=>scores.forEach(s=>oldGenre.aggregateGenreScores(s,classes))),genreAfterMs:measure(()=>scores.forEach(s=>genre.aggregateGenreScores(s,classes)))};
 // Real recurrent inference also agrees, including a mid-session reset.
 const events=[[],[]],models=[oldRhythm,rhythm].map((api,i)=>new api.LocalRhythmModel({modelPath:path.join(ROOT,'assets/models/beatnet-model-1.onnx'),onEvent:e=>events[i].push(e),now:()=>12345}));
 try{
  for(const model of models){assert.equal(await model.initialize(),true);for(let i=0;i<40;i++){if(i===20)model.reset();model.ingest(hops[i]);while(model.processing||model.queue.length)await new Promise(r=>setTimeout(r,1));}}
  assert.deepEqual(models[1].hidden,models[0].hidden);assert.deepEqual(models[1].cell,models[0].cell);assert.deepEqual(events[1],events[0]);
 }finally{await Promise.all(models.map(m=>m.close()));}
 const report={passed:true,baseline,exactFeatureHops:hops.length+25,exactGenreVectors:scores.length,exactRecurrentHops:40,timings,rhythmReduction:1-timings.rhythmAfterMs/timings.rhythmBeforeMs,genreReduction:1-timings.genreAfterMs/timings.genreBeforeMs};
 fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
