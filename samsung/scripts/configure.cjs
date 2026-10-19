const fs = require('node:fs');
const path = require('node:path');
function settings(config) {
  const url = new URL(config.remoteUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/')) throw new Error('remoteUrl must be an HTTPS directory URL without credentials, query or fragment');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(config.tvId || '')) throw new Error('tvId must use 1–128 letters, digits, underscores or hyphens');
  const mode = config.videoMode || 'inset';
  if (!['inset','fullscreen'].includes(mode)) throw new Error('videoMode must be inset or fullscreen');
  url.searchParams.set('nativeBridge','1'); url.searchParams.set('tvId',config.tvId);
  return {origin:url.origin,url:url.href,videoRectangle:mode==='inset'?['2%','2%','96%','96%']:['0%','0%','100%','100%']};
}
function build(file) {
  const root = path.resolve(__dirname, '..');
  const config = settings(JSON.parse(fs.readFileSync(file, 'utf8')));
  const output = path.join(root, 'dist/tv-app');
  fs.mkdirSync(output, {recursive:true});
  fs.cpSync(path.join(root, 'shell'), output, {recursive:true});
  fs.writeFileSync(path.join(output, 'deployment.js'), 'window.SAMSUNG_LAUNCHER = '+JSON.stringify(config)+';\n');
  const xml = fs.readFileSync(path.join(root, 'shell/config.xml'), 'utf8').replace('https://launcher.example.com',config.origin);
  fs.writeFileSync(path.join(output, 'config.xml'), xml);
  console.log('Configured samsung/dist/tv-app; contains private deployment values, do not commit.');
}
module.exports = {settings};
if (require.main === module) build(process.argv[2] || path.resolve(__dirname, '../deployment.local.json'));
