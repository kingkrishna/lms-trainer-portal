const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const routes = require('./routes');
const { generalLimiter } = require('./middleware/rateLimit');

const app = express();

app.use(helmet({
  contentSecurityPolicy: config.env === 'production',
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: config.env === 'production' ? config.frontendUrl : config.corsOrigins,
  credentials: true,
}));
app.use(generalLimiter);
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve frontend static files (so API_BASE /api works with same origin)
app.use(express.static(path.join(__dirname, '..', 'public'), { index: 'index.html' }));

app.use(config.apiBase, routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
