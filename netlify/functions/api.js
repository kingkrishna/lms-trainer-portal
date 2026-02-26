/**
 * Netlify Function – wraps Express app for serverless.
 * API requests to /api/* are proxied here via netlify.toml redirects.
 */
const serverless = require('serverless-http');
const app = require('../../server/app');

module.exports.handler = serverless(app, {
  binary: false,
});
