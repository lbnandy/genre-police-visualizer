'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {_electron}=require(process.env.GP_PLAYWRIGHT||'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),data=path.join(root,'output/beatnet-plus/qa',crypto.randomUUID());fs.mkdirSync(data,{recursive:true});
 fs.writeFileSync(path.join(data,'settings.json'),JSON.stringify({language:'zh-CN',impactMode:'beat',rhythmModelEnabled:true}));
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:process.env.GP_QA_EXE||path.join(root,'node_modules/electron/dist/electron.exe'),args:[...(process.env.GP_QA_EXE?[]:[root]),`--user-data-dir=${data}`],env});
 try{
  const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.waitForFunction(async()=>{const s=(await window.genrePolice.getConfig()).rhythmModelState;return s?.type==='ready'&&s.model?.startsWith('BeatNet+');});
  const runtime=await app.evaluate(({app})=>{
    const require=process.mainModule.require.bind(process.mainModule);
    const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
    const contract=require(path.join(app.getAppPath(),'src/rhythm-config.js'));
    const assets=app.isPackaged?path.join(process.resourcesPath,'app.asar.unpacked','assets'):path.join(app.getAppPath(),'assets');
    const config=contract.rhythmConfig(p=>path.join(assets,p));
    return {packaged:app.isPackaged,version:app.getVersion(),kind:config.modelKind,
      hash:crypto.createHash('sha256').update(fs.readFileSync(config.modelPath)).digest('hex')};
  });
  assert.equal(runtime.version,require('../package.json').version);
  assert.equal(runtime.packaged,Boolean(process.env.GP_QA_EXE));
  assert.equal(runtime.kind,'beatnet-plus');
  assert.equal(runtime.hash,require('../src/rhythm-config').MODEL_SHA256);
  console.log(JSON.stringify(runtime));
  await page.evaluate(async()=>{
   window.qaRhythm=[];window.genrePolice.onRhythmModel(e=>window.qaRhythm.push(e));
   for(let h=0;h<30;h++){
    window.genrePolice.submitRhythmAudio(Float32Array.from({length:441},(_,i)=>.3*Math.sin(2*Math.PI*110*(h*441+i)/22050)));
    await new Promise(r=>setTimeout(r,20));
   }
  });
  await page.waitForFunction(()=>window.qaRhythm.some(e=>e.type==='rhythm'));
  assert.equal(await page.evaluate(()=>window.qaRhythm.some(e=>e.type==='unavailable')),false);
  assert.deepEqual(errors,[]);
  console.log('Desktop BeatNet+ integration passed: selected model, PCM IPC, inference events, no renderer errors.');
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
