import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve actions from current server configuration, never from browser-supplied URLs.
export function resolveCommand(config, command, id, allowedPrefixes = []) {
  if (!['quick','command'].includes(command)) throw new Error('Unsupported command');
  const settings = config.settings || {};
  const items = command === 'quick' ? (config.quickSelect || settings.quickSelect || []) :
    (config.deviceCommands || settings.deviceCommands || config.projectorMenu || settings.projectorMenu || []);
  const item = Array.isArray(items) && items.find(x => x && !x.hidden && String(x.id) === String(id));
  if (!item || item.action || item.intentAction) throw new Error('Unsupported action');
  const route = item.url || item.requestUrl;
  // No origins, query strings, encoded paths, traversal or protocol-relative destinations.
  if (typeof route !== 'string' || !/^\/[A-Za-z0-9_/-]+$/.test(route) || route.includes('//') ||
      !allowedPrefixes.some(prefix => /^\/[A-Za-z0-9_/-]+\/$/.test(prefix) && route.startsWith(prefix))) throw new Error('Destination is not allowed');
  const method = String(item.method || item.requestMethod || 'GET').toUpperCase();
  if (!['GET','POST'].includes(method)) throw new Error('Unsupported method');
  return {route, method, body:item.body ?? item.requestBody ?? {}};
}

export function createSamsungRouter({express, getConfig, commandBaseUrl='', allowedPrefixes=[], fetchImpl=fetch}) {
  const router = express.Router();
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/web');
  let commandBase;
  if (commandBaseUrl) {
    commandBase = new URL(commandBaseUrl);
    if (commandBase.protocol !== 'https:' || commandBase.username || commandBase.password || commandBase.search || commandBase.hash) throw new Error('SAMSUNG_COMMAND_BASE_URL must be HTTPS without credentials/query/fragment');
  }
  const read = async req => {
    const id = String(req.query.tvId || '');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
    return getConfig(id);
  };
  router.use('/api', (req,res,next) => { res.setHeader('Cache-Control','no-store'); next(); });
  router.get('/api/config', async (req,res) => {
    try { const data=await read(req); if (!data) return res.status(404).json({error:'Unknown TV'}); res.json({data}); }
    catch { res.status(502).json({error:'Configuration unavailable'}); }
  });
  router.post('/api/action', async (req,res) => {
    // Requiring a custom header and JSON prevents cross-origin simple form requests.
    // Do not enable permissive CORS for these routes. Network authentication belongs at the deployment boundary.
    if (!req.is('application/json') || req.get('X-Samsung-Launcher') !== '1') return res.status(403).json({error:'Forbidden'});
    try {
      const config=await read(req); if (!config) return res.status(404).json({error:'Unknown TV'});
      if (!commandBase) return res.status(409).json({error:'Samsung backend commands are not configured'});
      let action;
      try { action=resolveCommand(config,req.body?.command,req.body?.id,allowedPrefixes); }
      catch { return res.status(400).json({error:'Unsupported Samsung action'}); }
      const url=commandBase.href.replace(/\/$/,'')+action.route;
      const response=await fetchImpl(url,{method:action.method,redirect:'error',signal:AbortSignal.timeout(5000),
        ...(action.method==='POST'?{headers:{'Content-Type':'application/json'},body:JSON.stringify(action.body)}:{})});
      if (!response.ok) throw new Error('Upstream failed');
      const raw=await response.text();
      if (raw) {
        let payload; try { payload=JSON.parse(raw); } catch { throw new Error('Expected JSON response'); }
        if (payload?.ok===false || payload?.success===false || payload?.error) throw new Error('Upstream rejected action');
      }
      res.json({ok:true});
    } catch { res.status(502).json({error:'Action unavailable'}); }
  });
  router.use(express.static(root,{etag:true,maxAge:0,index:'index.html',setHeaders(res) {
    res.setHeader('Cache-Control','no-cache'); res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    // The packaged Tizen shell embeds this origin; do not copy Android's frame-ancestors 'none'.
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'none'");
  }}));
  return router;
}
