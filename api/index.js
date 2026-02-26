/**
 * Vercel serverless handler – wraps Express app.
 * All requests are forwarded here via vercel.json rewrites.
 */
const app = require('../server/app');
module.exports = app;
