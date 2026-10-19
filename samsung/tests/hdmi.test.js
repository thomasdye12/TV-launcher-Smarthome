const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
function setup(failure) {
  const events = {}, calls = [], messages = [];
  const elements = {};
  ['watch-focus','menu','watching','message','runtime','clock','remote-ui'].forEach(id => elements[id] = {hidden:false,textContent:'',focus(){this.focused=true;}});
  const buttons = [1,2,3].map(() => ({click(){this.onclick();},focus(){ if(this.onfocus) this.onfocus(); }}));
  const sources = [{type:'HDMI',number:3},{type:'HDMI',number:1}];
  const disconnected = {type:'HDMI',number:2};
  elements['remote-ui'].contentWindow = {focus(){},postMessage(data){messages.push(data);}};
  const window = {SAMSUNG_LAUNCHER:{origin:'https://launcher.example.com',url:'https://launcher.example.com/samsung/?nativeBridge=1',videoRectangle:['2%','2%','96%','96%']},focus(){},addEventListener(name,fn){events[name]=fn;},setInterval(){},setTimeout(){return 1;},clearTimeout(){},tizen:{
    application:{getCurrentApplication(){return {exit(){calls.push('exit');}};}},
    systeminfo:{getPropertyValue(name,ok){assert.equal(name,'VIDEOSOURCE');ok({connected:sources,disconnected:[disconnected]});}},
    tvwindow:{show(ok,err,rect,type,z){assert.equal(z,'BEHIND');assert.deepEqual(Array.from(rect),['2%','2%','96%','96%']);calls.push('show');ok();},
      setSource(source,ok,err){calls.push(source.number); if(failure) err({message:'Source unavailable'});else ok();},
      hide(ok){calls.push('hide');ok();}}
  }};
  const document = {body:{className:''},hidden:false,querySelectorAll(){return buttons;},getElementById(id){return elements[id];},addEventListener(name,fn){events[name]=fn;}};
  vm.runInNewContext(fs.readFileSync('shell/app.js','utf8'),{window,document,clearTimeout:window.clearTimeout,setTimeout:window.setTimeout});
  return {elements,calls,messages,buttons,message(data,origin='https://launcher.example.com',source=elements['remote-ui'].contentWindow){events.message({data,origin,source});},key(code){events.keydown({keyCode:code,preventDefault(){}});}};
}
for (let port=1;port<=3;port++) {
 const app=setup(); app.buttons[port-1].onclick();
 assert.deepEqual(app.calls,['show',port]); assert.equal(app.elements.menu.hidden,true);
 app.key(10009); assert.equal(app.elements.menu.hidden,false); assert.equal(app.calls.at(-1),'hide');
 app.key(10009); assert.equal(app.calls.includes('exit'),false);
}
const failed=setup(true); failed.buttons[0].onclick();
assert.equal(failed.elements.menu.hidden,false);assert.match(failed.elements.message.textContent,/Source unavailable/);
const nav=setup();nav.key(39);nav.key(13);assert.equal(nav.calls[1],2);
console.log('Passed: all HDMI port mappings, disconnected input, Back navigation, source failure recovery, arrow/OK selection.');

const bridge=setup();
bridge.message({channel:'samsung-launcher-v1',action:'input',port:1},'https://example.com');
bridge.message({channel:'samsung-launcher-v1',action:'input',port:1},'https://launcher.example.com',{});
bridge.message({channel:'samsung-launcher-v1',action:'input',port:1.5});
assert.equal(bridge.calls.length,0);
bridge.message({channel:'samsung-launcher-v1',action:'ready'});
assert.equal(bridge.elements.menu.hidden,true);
bridge.message({channel:'samsung-launcher-v1',action:'input',port:2});
assert.deepEqual(bridge.calls,['show',2]);
bridge.key(10009);
assert.equal(bridge.elements['remote-ui'].hidden,false);
bridge.message({channel:'samsung-launcher-v1',action:'menu'});
assert.equal(bridge.elements.menu.hidden,false);
console.log('Passed: remote origin/window/port validation, remote HDMI selection, Back-to-launcher and local menu.');

const topKeys=setup();topKeys.message({channel:'samsung-launcher-v1',action:'ready'});topKeys.key(13);
assert.equal(topKeys.messages.at(-1).action,'key');assert.equal(topKeys.messages.at(-1).code,13);assert.equal(topKeys.calls.length,0);
console.log('Passed: outer-window Select forwards to the UI instead of activating a hidden local button.');

const frameBack=setup();
frameBack.message({channel:'samsung-launcher-v1',action:'ready'});
frameBack.message({channel:'samsung-launcher-v1',action:'input',port:1});
assert.equal(frameBack.elements['watch-focus'].focused,true);
assert.equal(frameBack.elements['watch-focus'].hidden,false);
frameBack.message({channel:'samsung-launcher-v1',action:'menu'},'https://example.com');
assert.equal(frameBack.calls.at(-1),1);
frameBack.message({channel:'samsung-launcher-v1',action:'menu'});
assert.equal(frameBack.calls.at(-1),'hide');
assert.equal(frameBack.elements['remote-ui'].hidden,false);
assert.equal(frameBack.elements['watch-focus'].hidden,true);
console.log('Passed: HDMI focus target and Back delivered through the hidden iframe return to the launcher.');
