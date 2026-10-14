const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {_electron}=require(process.env.GP_PLAYWRIGHT || 'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),data=path.join(root,'output/impact-qa',crypto.randomUUID());fs.mkdirSync(data,{recursive:true});
 fs.writeFileSync(path.join(data,'settings.json'),JSON.stringify({language:'zh-CN',impactMode:'music',rhythmModelEnabled:false}));
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const errors=[];
 for(let pass=0;pass<2;pass++){
 const app=await _electron.launch({executablePath:process.env.GP_QA_EXE||path.join(root,'node_modules/electron/dist/electron.exe'),args:[...(process.env.GP_QA_EXE?[]:[root]),`--user-data-dir=${data}`],env});
 try{
 const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));
 await page.waitForSelector('#settings-button');
 await page.locator('#settings-button').click();await page.locator('#settings-tab-playback').click();
 const config=await page.evaluate(()=>window.genrePolice.getConfig());
 assert.equal(config.impactMode,pass?'beat':'music');
 if(!pass){
 assert.equal(await page.locator('#beat-strength-row').isVisible(),false);
 await page.locator('[data-impact-mode=beat]').click();
 assert.equal(await page.locator('#beat-strength-row').isVisible(),true);
 assert.equal(await page.locator('#rhythm-model-toggle').isDisabled(),true);
 await page.locator('[data-beat-strength=fixed]').click();
 await page.waitForFunction(()=>document.querySelector('[data-beat-strength=fixed]').getAttribute('aria-checked')==='true');
 await page.locator('#impact-mode-row').scrollIntoViewIfNeeded();
 await page.screenshot({path:path.join(data,'settings.png')});
 const saved=await page.evaluate(()=>window.genrePolice.getConfig());assert.equal(saved.beatStrength,'fixed');assert.equal(saved.rhythmModelEnabled,true);
 }else{
 assert.equal(config.beatStrength,'fixed');
 await page.locator('[data-impact-mode=music]').click();
 assert.equal(await page.locator('#beat-strength-row').isVisible(),false);
 assert.equal(await page.locator('#rhythm-model-toggle').isDisabled(),false);
 }
 }finally{await app.close();}
 }
 assert.deepEqual(errors,[]);console.log('Impact settings UI and persistence passed. '+data);
})().catch(e=>{console.error(e);process.exitCode=1;});
