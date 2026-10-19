const {test}=require('node:test');
const assert=require('node:assert/strict');
const express=require('../../backend/node_modules/express');
const config={quickSelect:[{id:'watch',requestUrl:'/api/devices/7/channel',requestMethod:'POST',requestBody:{channel:1}}],projectorMenu:[{id:'light',url:'/api/devices/8/on'}]};
test('action policy: aliases, hidden entries, allowlist and no arbitrary destinations',async()=>{
 const {resolveCommand}=await import('../server/router.mjs');
 assert.deepEqual(resolveCommand(config,'quick','watch',['/api/devices/']),{route:'/api/devices/7/channel',method:'POST',body:{channel:1}});
 assert.equal(resolveCommand(config,'command','light',['/api/devices/']).method,'GET');
 assert.throws(()=>resolveCommand(config,'quick','watch'));
 for(const url of ['https://evil.example/','//evil.example/','/api/devices/../admin','/api/devices/%2e%2e/admin','/api/admin/','/api/devices/7/on?target=x'])
   assert.throws(()=>resolveCommand({quickSelect:[{id:'x',url}]},'quick','x',['/api/devices/']));
 for(const extra of [{hidden:true},{action:'sleep'},{intentAction:'android.settings.SETTINGS'},{method:'DELETE'}])
   assert.throws(()=>resolveCommand({quickSelect:[{id:'x',url:'/api/devices/7/on',...extra}]},'quick','x',['/api/devices/']));
});
test('HTTP routes return config, enforce JSON/header, and execute only stored commands',async(t)=>{
 const {createSamsungRouter}=await import('../server/router.mjs');
 const calls=[];
 const app=express();app.use(express.json());app.use('/samsung',createSamsungRouter({express,getConfig:async id=>id==='test'?config:null,commandBaseUrl:'https://api.example/Brain',allowedPrefixes:['/api/devices/'],fetchImpl:async(url,options)=>{calls.push({url,options});return {ok:true,text:async()=>'{"ok":true}'};}}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 t.after(()=>{server.closeAllConnections();server.close();});
 const root='http://127.0.0.1:'+server.address().port+'/samsung';
 assert.deepEqual(await (await fetch(root+'/api/config?tvId=test')).json(),{data:config});
 assert.equal((await fetch(root+'/api/config?tvId=unknown')).status,404);
 const post=(body,headers={})=>fetch(root+'/api/action?tvId=test',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 assert.equal((await post({command:'quick',id:'watch'})).status,403);
 assert.equal(calls.length,0);
 const res=await post({command:'quick',id:'watch',url:'https://evil.example/'},{'X-Samsung-Launcher':'1'});
 assert.equal(res.status,200);assert.equal(calls[0].url,'https://api.example/Brain/api/devices/7/channel');assert.equal(calls[0].options.redirect,'error');
 assert.equal((await post({command:'quick',id:'missing'},{'X-Samsung-Launcher':'1'})).status,400);
 assert.equal(calls.length,1);
});
