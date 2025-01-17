# Reverse proxy server

This is a simple reverse proxy server that forwards requests, dependent on the port number, to a specified server.

## Installation

Install the required packages:
`npm install`

Install `certbot`:
`sudo apt-get install certbot`

## Configuration

Copy `config.example.json` to `config.json` and adjust the configuration to your needs. You can add as many domains as you want. The `etcPath` value should be the path to the `etc` directory containing the `certbot` certificates.

## Running the server

Add the server to `pm2` for automatic restarts (in this instance, we name the pm2 process `reverse-proxy`):

`pm2 start server.js --name reverse-proxy`

## Add a new domain

To add a new domain:

1. Add a new key (domain) and value (port number) to the `domains` object in the `config.json` file.
2. Create an SSL certificate for the new domain with certbot: `certbot certonly --standalone -d example.com`
3. Restart the server with `pm2 restart reverse-proxy` (or whatever you named the pm2 process).
