const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
(async function(){
 const sent=[],events={},status={textContent:''};
 const parent={postMessage(data){sent.push(data);}};
 const window={location:{search:"?tvId=test"},parent,addEventListener(name,fn){events[name]=fn;},tvLauncherApplyConfig(){},tvLauncherHandleKey(e){sent.push({key:e.keyCode});}};
 const document={getElementById(id){return id==='clock'?{setAttribute(){}}:status;},addEventListener(){}};
 vm.runInNewContext(fs.readFileSync('web/bridge.js','utf8'),{window,document,URLSearchParams,localStorage:{getItem(){return null;},setItem(){}},setTimeout(){},clearTimeout(){},requestAnimationFrame(fn){fn();},fetch(){return Promise.resolve({ok:true,json(){return Promise.resolve({inputs:{HDMI1:{inputId:'HDMI1',hdmiPort:1},HDMI2:{inputId:'HDMI2',hdmiPort:2}}});}});}});
 await new Promise(resolve=>setImmediate(resolve));
 for(const port of [1,2]){window.tvLauncherActivate({getAttribute(){return 'tvlauncher://input?id=HDMI'+port;}});assert.equal(sent.at(-1).port,port);}
 window.tvLauncherActivate({getAttribute(){return 'tvlauncher://admin';}});assert.equal(sent.at(-1).action,'menu');
 events.message({source:parent,data:{channel:'samsung-shell-v1',action:'key',code:13}});assert.equal(sent.at(-1).key,13);
 const before=sent.length;events.message({source:{},data:{channel:'samsung-shell-v1',action:'key',code:13}});assert.equal(sent.length,before);
 console.log('Passed: direct select activation, custom links without URL parsing, admin action, trusted forwarded select.');
})();
