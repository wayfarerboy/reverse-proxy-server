import chalk from 'chalk';
import { readFileSync } from 'fs';
import https from 'https';
import httpProxy from 'http-proxy';
import { createSecureContext } from 'tls';

import config from './config.mjs';

const proxy = httpProxy.createProxyServer({ ws: true });

const getCertKey = (domain) => ({
  key: readFileSync(
    `${config.etcPath}/certbot/certs/live/${domain}/privkey.pem`,
  ),
  cert: readFileSync(
    `${config.etcPath}/certbot/certs/live/${domain}/fullchain.pem`,
  ),
});

const callbacks = {};
Object.keys(config.domains)
  .filter((val) => typeof config.domains[val] === 'number' && !val.includes('/'))
  .forEach((domain) => {
    console.log(
      chalk.cyan(domain),
      '>>>',
      chalk.magentaBright.dim(`localhost:${config.domains[domain]}`),
    );
    callbacks[domain] = createSecureContext(getCertKey(domain));
  });

const options = {
  SNICallback: (domain, cb) => {
    const result = callbacks[domain];
    cb(null, result);
  },
};

const CLI_HOST = 'cli.generamics.co.uk';

// HTTP basic auth gate for the cli.generamics.co.uk domain (terminal + panel).
const authorized = (req) => {
  if (getHost(req) !== CLI_HOST) return true; // only gate the cli domain
  const { user, pass } = config.cliAuth || {};
  if (!user) return true; // no credential configured -> allow
  const auth = req.headers['authorization'] || '';
  const [scheme, b64] = auth.split(' ');
  if (scheme !== 'Basic' || !b64) return false;
  let decoded;
  try {
    decoded = Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return false;
  }
  const i = decoded.indexOf(':');
  if (i === -1) return false;
  return decoded.slice(0, i) === user && decoded.slice(i + 1) === pass;
};

const getHost = (req) => req.headers.host.split(':')[0];
const getRoute = (req) => req.url.split('?')[0];
const getHostname = (req) => {
  const host = getHost(req);
  let route = getRoute(req);
  route = route.endsWith('/') ? route.substr(0, route.length - 1) : route;
  const mapFrom = host + route;
  // longest-prefix match: a key maps if it equals mapFrom or is a path-prefix of
  // it (so a '/term' key also covers '/term', '/term/', '/term/ws', '/term/token').
  let best = null;
  for (const key of Object.keys(config.domains)) {
    if (typeof config.domains[key] !== 'number') continue;
    if (mapFrom === key || mapFrom.startsWith(key + '/')) {
      if (!best || key.length > best.length) best = key;
    }
  }
  return best || host;
};

const getPort = (req) => {
  const hostName = getHostname(req);
  const port = config.domains[hostName];
  return [port, hostName];
};

const server = https.createServer(options, (req, res) => {
  if (!authorized(req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="webterm"' });
    res.end('Unauthorized');
    return;
  }
  const [port, mapFrom, otherHost = 'localhost'] = getPort(req);
  if (typeof port === 'number') {
    console.log('https', getHost(req), getRoute(req));
    proxy.web(req, res, { target: { host: otherHost, port } });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Unmapped url: ' + mapFrom);
});

server.on('upgrade', (req, res) => {
  if (!authorized(req)) {
    res.write('HTTP/1.1 401 Unauthorized\r\nWWW-Authenticate: Basic realm="webterm"\r\n\r\n');
    res.destroy();
    return;
  }
  const [port, mapFrom, otherHost = 'localhost'] = getPort(req);
  if (typeof port === 'number') {
    console.log('wss', getHost(req), getRoute(req));
    proxy.ws(req, res, { target: { host: otherHost, port } });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Unmapped url: ' + mapFrom);
});

server.listen(443);
console.log(chalk.green('✓ Server started'));
