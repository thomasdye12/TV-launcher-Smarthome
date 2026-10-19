(function(){
  'use strict';
  var config={}, timer, requestBusy=false, firstFocus=true;
  var tvId = new URLSearchParams(window.location.search).get('tvId') || '';
  var query = '?tvId=' + encodeURIComponent(tvId);
  var cacheKey = 'samsung-launcher-config:' + tvId;
  document.getElementById('clock').setAttribute('aria-label','Open local TV controls');
  function status(text){document.getElementById('status').textContent=text;}
  function send(action,port){window.parent.postMessage({channel:'samsung-launcher-v1',action:action,port:port},'*');}
  function portFor(id){
    var inputs=config.inputs||{};
    var keys=Object.keys(inputs);
    for(var i=0;i<keys.length;i++){
      var input=inputs[keys[i]];
      if(!input.hidden && String(input.inputId||keys[i])===String(id)){
        var port=Number(input.hdmiPort || String(input.inputId||keys[i]).replace(/^HDMI/i,''));
        if(port>=1&&port<=4&&port%1===0)return port;
      }
    }
    return null;
  }
  function choose(id){var port=portFor(id);if(port)send('input',port);else status('This input needs a Samsung HDMI port mapping.');}
  function cached(){try{var saved=localStorage.getItem(cacheKey);if(saved){config=JSON.parse(saved);window.tvLauncherApplyConfig(config);status('Cached configuration · server unavailable');}}catch(ignore){}}
  function load(){
    clearTimeout(timer);
    fetch('./api/config'+query,{cache:'no-store'}).then(function(response){if(!response.ok)throw new Error('Config unavailable');return response.json();}).then(function(payload){
      config=payload.data||payload;window.tvLauncherApplyConfig(config);
      try{localStorage.setItem(cacheKey,JSON.stringify(config));}catch(ignore){}
      send('ready');
      schedule();
    }).catch(function(){cached();status('Server unavailable · Back opens offline inputs');if(Object.keys(config.inputs||{}).length)send('ready');schedule();});
  }
  function schedule(){var seconds=Number((config.settings||{}).configPollSeconds)||20;timer=setTimeout(load,Math.max(5,Math.min(300,seconds))*1000);}
  function activate(link){
    if(!link)return;
    var raw=link.getAttribute('href')||'';
    var match=/^tvlauncher:\/\/([a-z]+)(?:\?id=([^#]*))?$/.exec(raw);
    if(!match)return;
    var command=match[1],id='';
    try{id=decodeURIComponent(match[2]||'');}catch(ignore){status('Invalid input link');return;}

    if(command==='input'){choose(id);return;}
    if(command==='admin'){send('menu');return;}
    if(command!=='quick'&&command!=='command')return;
    if(requestBusy)return;
    var items=command==='quick'?(config.quickSelect||(config.settings||{}).quickSelect||[]):(config.deviceCommands||(config.settings||{}).deviceCommands||config.projectorMenu||(config.settings||{}).projectorMenu||[]);
    var item=items.filter(function(x){return x && !x.hidden && String(x.id)===id;})[0];
    if(!item){status('Action unavailable');return;}
    if(item.action==='refreshConfig'){load();return;}
    if(item.action==='inputSettings'||item.action==='tvSettings'){send('menu');status('Local input controls; use the Samsung remote for system settings.');return;}
    var requestUrl=item.url||item.requestUrl;
    if(item.action||item.intentAction||String(requestUrl||'').indexOf('tds:')===0){status('This Android-only panel is not available on Samsung.');return;}
    if(!requestUrl){if(item.inputId)choose(item.inputId);return;}
    // Complete the request before switching: Tizen may suspend us as soon as HDMI opens.
    if(item.inputId&&item.requestBeforeInput===false){status('Samsung requires requestBeforeInput for this action.');return;}
    requestBusy=true;status('Sending request…');
    fetch('./api/action'+query,{method:'POST',headers:{'Content-Type':'application/json','X-Samsung-Launcher':'1'},body:JSON.stringify({command:command,id:id})}).then(function(response){if(!response.ok)throw new Error('Action failed');return response.json();}).then(function(){status('Request sent');if(item.inputId)choose(item.inputId);}).catch(function(){status('Action unavailable · try again');}).then(function(){requestBusy=false;});
  }
  window.tvLauncherActivate=activate;
  document.addEventListener('click',function(event){var link=event.target.closest('a');if(link&&(link.getAttribute('href')||'').indexOf('tvlauncher://')===0){event.preventDefault();activate(link);}},true);
  document.addEventListener('keydown',function(event){if(event.keyCode===10009||event.keyCode===27){event.preventDefault();event.stopImmediatePropagation();send('menu');}},true);
  window.addEventListener('message',function(event){if(event.source!==window.parent||!event.data||event.data.channel!=='samsung-shell-v1')return;if(event.data.action==='key'&&[13,37,38,39,40].indexOf(event.data.code)!==-1){window.tvLauncherHandleKey({keyCode:event.data.code,repeat:!!event.data.repeat,preventDefault:function(){},stopImmediatePropagation:function(){}});}else if(event.data.action==='focus'){requestAnimationFrame(function(){requestAnimationFrame(function(){var first=document.querySelector('.source-card');if(firstFocus&&first){firstFocus=false;first.focus();}else window.tvLauncherRestoreFocus();});});}});
  cached();load();
}());
