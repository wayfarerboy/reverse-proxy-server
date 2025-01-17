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
  .filter((val) => typeof config.domains[val] === 'number')
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

const getHost = (req) => req.headers.host.split(':')[0];
const getRoute = (req) => req.url.split('?')[0];
const getHostname = (req) => {
  const host = getHost(req);
  let route = getRoute(req);
  route = route.endsWith('/') ? route.substr(0, route.length - 1) : route;
  const mapFrom = host + route;
  return config.domains[mapFrom] ? mapFrom : host;
};

const getPort = (req) => {
  const hostName = getHostname(req);
  const port = config.domains[hostName];
  return [port, hostName];
};

const server = https.createServer(options, (req, res) => {
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
