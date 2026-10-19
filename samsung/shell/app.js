(function () {
  'use strict';
  var buttons = Array.prototype.slice.call(document.querySelectorAll('#menu button'));
  var selected = 0;
  var viewing = false;
  var busy = false;
  var isTV = !!(window.tizen && window.tizen.tvwindow && window.tizen.systeminfo);
  var menu = document.getElementById('menu');
  var overlay = document.getElementById('watching');
  var hintTimer;
  var remote = document.getElementById('remote-ui');
  var remoteReady = false;
  var deployment = window.SAMSUNG_LAUNCHER;
  var remoteOrigin = deployment.origin;
  var remoteUrl = deployment.url;
  var remoteTimer;
  function trace(name, detail) {
    // Local console only. No hard-coded telemetry destinations.
    if (window.console) window.console.log('[Samsung launcher]', name, detail || '');
  }
  window.addEventListener('error', function(event) { trace('error', event.message); });
  trace('start');
  function focusRemote() {
    menu.hidden = true; remote.hidden = false;
    remote.contentWindow.focus();
    remote.contentWindow.postMessage({channel:'samsung-shell-v1',action:'focus'}, remoteOrigin);
  }
  function loadRemote() {
    remoteReady = false;
    message('Connecting to launcher…');
    remote.src = remoteUrl + '&shell=0.1.0&load=' + Date.now();
    clearTimeout(remoteTimer);
    remoteTimer = setTimeout(function () { if (!remoteReady && !viewing && !busy) showMenu('Server unavailable. Use the HDMI buttons or retry the launcher.'); }, 12000);
  }
  window.addEventListener('message', function (event) {
    if (event.origin !== remoteOrigin || event.source !== remote.contentWindow || !event.data || event.data.channel !== 'samsung-launcher-v1') return;
    var data = event.data;
    if (data.action === 'ready') { var first = !remoteReady; remoteReady = true; clearTimeout(remoteTimer); if (first && !viewing && !busy) focusRemote(); }
    else if (data.action === 'input' && !viewing && !busy && typeof data.port === 'number' && data.port % 1 === 0 && data.port >= 1 && data.port <= 4) pick(data.port);
    else if (data.action === 'menu' && !busy) {
      // Older TV browsers can leave keyboard focus in the hidden iframe.
      if (viewing) back();
      else showMenu('Local controls · choose an input or return to the launcher.');
    }
  });
  function message(text) { document.getElementById('message').textContent = text; }
  function focus(index) { selected = (index + buttons.length) % buttons.length; buttons[selected].focus(); }
  function showMenu(text) {
    viewing = false; busy = false;
    window.clearTimeout(hintTimer);
    document.body.className = '';
    remote.hidden = true; menu.hidden = false; overlay.hidden = true;
    document.getElementById('watch-focus').hidden = true;
    message(text || 'Choose an HDMI input.'); focus(selected);
  }
  function fail(error) {
    if (isTV) { try { window.tizen.tvwindow.hide(function () {}, function () {}); } catch (ignored) {} }
    showMenu('Could not open HDMI: ' + (error.message || error.name || String(error)) + '. Try again.');
  }
  function watch(number) {
    trace("watch", String(number));
    busy = false; viewing = true;
    menu.hidden = true; remote.hidden = true; window.focus(); document.body.className = 'viewing';
    overlay.textContent = (isTV ? 'HDMI ' : 'Preview · HDMI ') + number + '  ·  Back to launcher (experimental)';
    overlay.hidden = false;
    var watchFocus = document.getElementById('watch-focus');
    watchFocus.hidden = false; watchFocus.focus();
    window.clearTimeout(hintTimer);
    // Keep the label visible so we can distinguish embedded HDMI from native TV mode.
    hintTimer = window.setTimeout(function () { if (viewing) trace('embedded-alive', 'hidden=' + document.hidden); }, 10000);
  }
  function pick(number) {
    if (busy || viewing) { return; }
    if (!isTV) { watch(number); return; }
    busy = true; message('Opening HDMI ' + number + '…');
    try {
      window.tizen.systeminfo.getPropertyValue('VIDEOSOURCE', function (info) {
        var sources = (info.connected || []).concat(info.disconnected || []);
        var source = null;
        sources.forEach(function (item) { if (item.type === 'HDMI' && item.number === number) { source = item; } });
        if (!source) { showMenu('HDMI ' + number + ' was not reported by this TV.'); return; }
        try {
          window.tizen.tvwindow.show(function () {
            try {
              window.tizen.tvwindow.setSource(source, function () { watch(number); }, fail, 'MAIN');
            } catch (error) { fail(error); }
          }, fail, deployment.videoRectangle, 'MAIN', 'BEHIND');
        } catch (error) { fail(error); }
      }, fail);
    } catch (error) { fail(error); }
  }
  function back() {
    trace("back", "viewing=" + viewing + ",busy=" + busy);
    if (busy) { return; }
    if (viewing) {
      if (!isTV) { showMenu(); if(remoteReady)focusRemote(); return; }
      busy = true;
      try { window.tizen.tvwindow.hide(function () { trace("hide-success"); showMenu(); if(remoteReady)focusRemote(); }, function (error) { busy = false; overlay.textContent = 'Could not return: ' + error.message + '. Press Back to retry.'; overlay.hidden = false; }); }
      catch (error) { busy = false; overlay.textContent = 'Press Back to retry: ' + error.message; overlay.hidden = false; }
    } else if (remoteReady) { focusRemote();
    } else { showMenu('Choose an input, or use Exit app to close the launcher.'); }
  }
  buttons.forEach(function (button, index) {
    button.onfocus = function () { selected = index; };
    button.onclick = function () {
      if (index < 3) pick(index + 1);
      else if (button.id === 'retry-ui') { loadRemote(); }
      else if (button.id === 'return-ui') { if(remoteReady)focusRemote();else loadRemote(); }
      else if (button.id === 'exit-app') { if(window.tizen && window.tizen.application)window.tizen.application.getCurrentApplication().exit(); }
    };
  });
  document.addEventListener('keydown', function (event) {
    var code = event.keyCode;
    trace("key", String(code));
    if (code === 10009 || code === 27) {
      event.preventDefault();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }
    if (remoteReady && !remote.hidden && !viewing && !busy) {
      if (code === 10009 || code === 27) { event.preventDefault(); showMenu('Local controls'); return; }
      if ([13,37,38,39,40].indexOf(code) !== -1) {
        event.preventDefault();
        remote.contentWindow.postMessage({channel:'samsung-shell-v1',action:'key',code:code,repeat:!!event.repeat},remoteOrigin);
        return;
      }
    }
    if (code === 10009 || code === 27) { event.preventDefault(); back(); return; }
    if (viewing || busy) { return; }
    if (code === 37 || code === 38) { event.preventDefault(); focus(selected - 1); }
    else if (code === 39 || code === 40) { event.preventDefault(); focus(selected + 1); }
    else if (code === 13) { event.preventDefault(); buttons[selected].click(); }
  }, true);
  document.addEventListener('visibilitychange', function () {
    trace('visibility', 'hidden=' + document.hidden + ',viewing=' + viewing); 
    if (document.hidden && viewing) {
      try { window.tizen.tvwindow.hide(function () {}, function () {}); } catch (ignored) {}
      showMenu();
    }
  });
  function clock() { document.getElementById('clock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  document.getElementById('runtime').textContent = isTV ? 'HDMI input selector' : 'Browser preview · no live video';
  clock(); window.setInterval(clock, 1000); focus(0); loadRemote();
}());
