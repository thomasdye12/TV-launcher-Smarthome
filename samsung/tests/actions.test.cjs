const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function setup(item,actionOK=true) {
 const sent=[],requests=[],delays=[],status={textContent:''};
 const parent={postMessage:m=>sent.push(m)};
 const config={settings:{configPollSeconds:45},inputs:{HDMI1:{inputId:'HDMI1',hdmiPort:1}},quickSelect:[item]};
 const window={location:{search:'?tvId=room-2'},parent,addEventListener(){},tvLauncherApplyConfig(){}};
 vm.runInNewContext(fs.readFileSync('web/bridge.js','utf8'),{window,URLSearchParams,document:{getElementById:id=>id==='clock'?{setAttribute(){}}:status,addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},clearTimeout(){},setTimeout(fn,ms){delays.push(ms);},fetch:async(url,options)=>{requests.push({url,options});return {ok:options.method==='POST'?actionOK:true,json:async()=>options.method==='POST'?{ok:true}:{data:config}};}});
 await flush();
 return {sent,requests,delays,status,choose:()=>window.tvLauncherActivate({getAttribute:()=> 'tvlauncher://quick?id=watch'})};
}
test('quick action defaults to request-first and supports requestUrl aliases',async()=>{
 const a=await setup({id:'watch',inputId:'HDMI1',requestUrl:'/api/devices/7/on'});
 a.choose();assert.equal(a.sent.filter(x=>x.action==='input').length,0);
 await flush();assert.equal(a.sent.at(-1).port,1);assert.equal(a.requests.at(-1).url,'./api/action?tvId=room-2');
 assert.equal(a.requests.at(-1).options.headers['X-Samsung-Launcher'],'1');assert.equal(a.delays.at(-1),45000);
});
test('failed backend action does not switch HDMI',async()=>{
 const a=await setup({id:'watch',inputId:'HDMI1',url:'/api/devices/7/on'},false);a.choose();await flush();
 assert.equal(a.sent.some(x=>x.action==='input'),false);assert.match(a.status.textContent,/unavailable/);
});
test('hidden actions and request-after-input cannot execute',async()=>{
 for(const extra of [{hidden:true},{requestBeforeInput:false}]) {
  const a=await setup({id:'watch',inputId:'HDMI1',url:'/api/devices/7/on',...extra});a.choose();await flush();
  assert.equal(a.requests.length,1);assert.equal(a.sent.some(x=>x.action==='input'),false);
 }
});
