const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const shared = path.resolve(root, '../backend/public/v2');
const output = path.join(root, 'dist/web');
fs.mkdirSync(output, {recursive: true});
let source = fs.readFileSync(path.join(shared, 'app.js'), 'utf8');
source = source.replace(/function nativeUrl\(command, id\) \{[\s\S]*?\n\}/, `function nativeUrl(command, id) {
  return 'tvlauncher://' + command + (id !== undefined ? '?id=' + encodeURIComponent(id) : '');
}`);
source = source.replace("document.addEventListener('keydown', event => {", "window.tvLauncherHandleKey = function(event) {");
source = source.replace("else if (!event.repeat) current.click();\n}, true);", "else if (!event.repeat) { if (window.tvLauncherActivate) window.tvLauncherActivate(current); else current.click(); }\n};\ndocument.addEventListener('keydown', window.tvLauncherHandleKey, true);");
if (!source.includes('window.tvLauncherHandleKey =') || !source.includes('window.tvLauncherActivate(current)')) throw new Error('Shared keyboard handler changed: review Samsung adapter.');
fs.writeFileSync(path.join(output, 'launcher.js'), esbuild.transformSync(source, {target:'chrome56',format:'iife'}).code);
let html = fs.readFileSync(path.join(shared, 'index.html'), 'utf8')
  .replace(/\.\/styles\.css(?:\?[^" ]*)?/, './styles.css')
  .replace(/<script src="\.\/app\.js[^"]*"[^>]*><\/script>/, '<script src="./compat.js" defer></script><script src="./launcher.js" defer></script><script src="./bridge.js" defer></script>');
fs.writeFileSync(path.join(output, 'index.html'), html);
fs.writeFileSync(path.join(output, 'styles.css'), esbuild.transformSync(fs.readFileSync(path.join(shared, 'styles.css'), 'utf8'), {loader:'css',target:'chrome56'}).code + fs.readFileSync(path.join(root, 'web/layout.css'), 'utf8'));
for (const file of ['bridge.js','compat.js']) fs.copyFileSync(path.join(root, 'web', file), path.join(output, file));
fs.cpSync(path.join(shared, 'symbols'), path.join(output, 'symbols'), {recursive:true});
console.log('Built samsung/dist/web from backend/public/v2');
