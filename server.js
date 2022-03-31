#!/usr/bin/env node

const chalk = require('chalk');
const { readFileSync } = require('fs');
const https = require('https');
const proxy = require('http-proxy').createProxyServer({});
const { createSecureContext } = require('tls');

const config = require('./config.json');

const getCertKey = (domain) => ({
  key: readFileSync(
    `/opt/homebrew/etc/certbot/certs/live/${domain}/privkey.pem`,
  ),
  cert: readFileSync(
    `/opt/homebrew/etc/certbot/certs/live/${domain}/fullchain.pem`,
  ),
});

const callbacks = {};
Object.keys(config)
  .filter((val) => typeof config[val] === 'number')
  .forEach((domain) => {
    console.log(
      chalk.cyan(domain),
      '>>>',
      chalk.magentaBright.dim(`localhost:${config[domain]}`),
    );
    callbacks[domain] = createSecureContext(getCertKey(domain));
  });

const options = {
  SNICallback: (domain, cb) => {
    const result = callbacks[domain];
    cb(null, result);
  },
};

const server = https.createServer(options, (req, res) => {
  const host = req.headers.host.split(':')[0];
  let route = req.url.split('?')[0];
  route = route.endsWith('/') ? route.substr(0, route.length - 1) : route;
  const mapFrom = host + route;
  const port = config[mapFrom] || config[host];
  if (typeof port === 'number') {
    proxy.web(req, res, { target: { host: 'localhost', port } });
    return;
  } else if (port === 'ws') {
    proxy.web(req, res, { target: `ws://localhost:3000` });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Unmapped url: ' + mapFrom);
});

server.listen(443);
console.log(chalk.green('✓ Server started'));
