// Run: node backend/tests/web-ui.test.cjs /path/to/linkedom
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('../../backend/node_modules/linkedom');
const root = path.join(__dirname, '../dist/web');
const { document, window } = parseHTML(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
let active = document.getElementById('clock'), focusCalls = 0;
Object.defineProperty(document, 'activeElement', {get: () => active?.isConnected ? active : document.body});
Object.defineProperty(window.HTMLElement.prototype, 'offsetParent', {get() { return this.closest('[hidden]') ? null : document.body; }});
window.HTMLElement.prototype.focus = function () {
  active = this; focusCalls++;
  this.dispatchEvent(new window.Event('focusin', {bubbles: true}));
};
const context = vm.createContext({
  document, window: {addEventListener() {}},
  location: {search:'?tvId=test&nativeBridge=1',origin:'https://tv.test',href:'https://tv.test/?tvId=test',reload() {throw new Error('Unexpected reload');}},
  sessionStorage: {getItem() {return null;}, setItem() {}},
  URL, URLSearchParams, Intl, AbortController,
  setTimeout() {return 1;}, clearTimeout() {}, setInterval() {},
  requestAnimationFrame(fn) {fn();},
  fetch() {throw new Error('Unexpected network request');}
});
context.window.location = context.location;
vm.runInContext(fs.readFileSync(path.join(root, 'launcher.js'), 'utf8'), context, {timeout:3000});
const config = {
  name:'Example TV', webAppRevision:'test',
  inputs: {sky:{inputId:'hdmi2',label:'Sky Q',order:1}, apple:{inputId:'hdmi3',label:'Apple TV',order:2}},
  quickSelect:[{id:'f1tv',inputId:'hdmi2',label:'F1'}],
  deviceCommands:[{id:'lights',label:'Lights',stateKey:'lights'},{id:'speaker',label:'Room audio',stateKey:'speaker'},{id:'guide',label:'TV Guide'}]
};
context.testConfig = config;
vm.runInContext('window.tvLauncherApplyConfig(testConfig)', context, {timeout:3000});
const sky = document.querySelector('.source-card');
assert.equal(active, sky, 'First config must choose a source even if WebView initially focused clock');
const quick = document.querySelector('.quick-card');
assert.equal(quick.getAttribute('href'), 'tvlauncher://quick?id=f1tv', 'Quick action uses its action ID, not HDMI inputId');
function key(name) {
  const event = new window.Event('keydown', {bubbles:true,cancelable:true});
  event.key = name; document.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
}
key('ArrowDown'); assert.equal(active, quick, 'Down from source must reach Quick Select');
const beforePolls = focusCalls;
for (let n = 0; n < 120; n++) context.window.tvLauncherApplyConfig({...config,deviceStatus:{lastSeen:n}});
assert.equal(document.querySelector('.quick-card'), quick, 'Button identity survives repeated native injections');
assert.equal(active, quick); assert.equal(focusCalls, beforePolls, 'No refocus during native injections');
key('ArrowDown'); assert.equal(active, quick, 'Bottom edge holds focus');
key('ArrowRight'); assert.equal(active.dataset.focusId, 'command:lights');
key('ArrowDown'); assert.equal(active.dataset.focusId, 'command:speaker');
key('ArrowLeft'); assert.equal(active, quick, 'Return from room controls to remembered primary tile');
key('ArrowUp'); assert.equal(active, sky);
key('ArrowRight'); assert.equal(active.dataset.focusId, 'input:hdmi3');
key('ArrowDown'); assert.equal(active, quick, 'Down from Apple TV also reaches quick actions');
context.window.tvLauncherApplyConfig({...config,quickSelect:[]});
assert.equal(active, sky, 'Removing focused tile picks a remaining source');
let selected; context.window.tvLauncherActivate = tile => {selected = tile;};
context.window.tvLauncherHandleKey({keyCode:13,preventDefault(){},stopImmediatePropagation(){}});
assert.equal(selected,sky,'Forwarded Select activates the focused card directly');
console.log('PASS: compiled Samsung UI navigation, 120 config injections, tile removal and forwarded Select');
