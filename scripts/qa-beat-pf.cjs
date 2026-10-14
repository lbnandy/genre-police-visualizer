const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {LocalRhythmModel}=require('../src/rhythm-model-runtime');
(async()=>{const root=path.resolve(__dirname,'..'),out=path.join(root,'output/beat-pf');fs.mkdirSync(out,{recursive:true});const report=[];
for(const file of process.argv.slice(2)){
 const raw=execFileSync('ffmpeg',['-v','error','-i',file,'-t','40','-ar','22050','-ac','1','-f','f32le','pipe:1'],{maxBuffer:10e6});const pcm=new Float32Array(raw.buffer,raw.byteOffset,raw.byteLength/4);let now=0;const beats=[],peaks=[],times=[];
 const model=new LocalRhythmModel({modelPath:path.join(root,'assets/models/beatnet-model-1.onnx'),now:()=>now,onEvent:e=>{if(e.type==='unavailable')throw Error(e.reason);if(e.trackedBeat)beats.push(now);if(e.peak)peaks.push(now);}});
 assert.equal(await model.initialize(),true);
 try{for(let i=0;i+441<=pcm.length;i+=441){now=i/22.05;const at=performance.now();model.ingest(pcm.subarray(i,i+441));while(model.processing||model.queue.length)await new Promise(r=>setImmediate(r));times.push(performance.now()-at);}}finally{await model.close();}
 times.sort((a,b)=>a-b);const item={file:path.basename(file),duration:pcm.length/22050,oldPeaks:peaks.length,trackedBeats:beats.length,beats,medianFrameMs:times[Math.floor(times.length*.5)],p95FrameMs:times[Math.floor(times.length*.95)]};
 if(path.basename(file)==='808kick120bpm.mp3'){
  const stable=beats.filter(t=>t>=2000);assert.ok(stable.length>=15&&stable.length<=16);for(const t of stable)assert.ok(Math.abs(t-Math.round(t/500)*500)<=40);
 }
 report.push(item);console.log(JSON.stringify({...item,beats:beats.slice(0,10)}));
}
fs.writeFileSync(path.join(out,'audio-report.json'),JSON.stringify(report,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
