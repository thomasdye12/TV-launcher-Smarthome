/* DOM additions used by the shared Android launcher, absent on Tizen 4. */
if (!Element.prototype.replaceChildren) Element.prototype.replaceChildren = function () {
  while (this.firstChild) this.removeChild(this.firstChild);
  for (var i=0;i<arguments.length;i++) this.appendChild(arguments[i]);
};
if (!Object.fromEntries) Object.fromEntries = function (entries) {
  var result = {}; entries.forEach(function (entry) { result[entry[0]] = entry[1]; }); return result;
};
if (!window.AbortController) window.AbortController = function () {
  this.signal = {aborted:false, listeners:[], addEventListener:function(type,fn){if(type==='abort')this.listeners.push(fn);}};
  this.abort = function () { this.signal.aborted=true;this.signal.listeners.forEach(function(fn){fn();}); };
};
/* XHR provides a real timeout and cancellation on the older TV engine. */
window.fetch = function (url, options) {
  options=options||{};
  return new Promise(function(resolve,reject){
    var xhr=new XMLHttpRequest();xhr.open(options.method||'GET',String(url));xhr.timeout=8000;
    Object.keys(options.headers||{}).forEach(function(key){xhr.setRequestHeader(key,options.headers[key]);});
    xhr.onload=function(){resolve({ok:xhr.status>=200&&xhr.status<300,status:xhr.status,json:function(){return Promise.resolve().then(function(){return JSON.parse(xhr.responseText);});}});};
    xhr.onerror=xhr.ontimeout=xhr.onabort=function(){reject(new Error('Network unavailable'));};
    if(options.signal){if(options.signal.aborted){reject(new Error('Aborted'));return;}options.signal.addEventListener('abort',function(){xhr.abort();});}
    xhr.send(options.body||null);
  });
};
