require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  apiBase: process.env.API_BASE_URL || '/api',
  frontendUrl: process.env.FRONTEND_URL || (process.env.RENDER_EXTERNAL_URL ? process.env.RENDER_EXTERNAL_URL : null) || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) || (process.env.URL ? process.env.URL : null) || 'http://localhost:5500',
  // In development, allow common origins (Live Server 5500, Node 3000)
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
    : [
        'http://localhost:3000',
        'http://localhost:5500',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5500',
      ],

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'lms_platform',
    dialect: process.env.DB_DIALECT || 'mysql',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production-min-32-chars',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    cookieName: process.env.JWT_COOKIE_NAME || 'lms_token',
  },

  payment: {
    provider: process.env.PAYMENT_PROVIDER || 'razorpay',
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID,
      keySecret: process.env.RAZORPAY_KEY_SECRET,
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    },
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },

  zoho: {
    clientId: process.env.ZOHO_CLIENT_ID,
    clientSecret: process.env.ZOHO_CLIENT_SECRET,
    refreshToken: process.env.ZOHO_REFRESH_TOKEN,
    crmOrgId: process.env.ZOHO_CRM_ORG_ID,
    calendarId: process.env.ZOHO_CALENDAR_ID || '',
    accountsBase: process.env.ZOHO_ACCOUNTS_BASE || 'https://accounts.zoho.com',
    apiBase: process.env.ZOHO_API_BASE || 'https://www.zohoapis.com',
    booksOrgId: process.env.ZOHO_BOOKS_ORG_ID || '',
    booksCustomerId: process.env.ZOHO_BOOKS_CUSTOMER_ID || '',
    cliqWebhookUrl: process.env.ZOHO_CLIQ_WEBHOOK_URL || '',
    mailAccountId: process.env.ZOHO_MAIL_ACCOUNT_ID || '',
    mailFrom: process.env.ZOHO_MAIL_FROM || '',
    signTemplateId: process.env.ZOHO_SIGN_TEMPLATE_ID || '',
    signActionId: process.env.ZOHO_SIGN_ACTION_ID || '',
    workdriveTeamId: process.env.ZOHO_WORKDRIVE_TEAM_ID || '',
    meetingZsoid: process.env.ZOHO_MEETING_ZSOID || '',
    meetingTimezone: process.env.ZOHO_MEETING_TIMEZONE || 'Asia/Kolkata',
    deskOrgId: process.env.ZOHO_DESK_ORG_ID || '',
    deskDepartmentId: process.env.ZOHO_DESK_DEPARTMENT_ID || '',
    analyticsWorkspaceId: process.env.ZOHO_ANALYTICS_WORKSPACE_ID || '',
  },
};
