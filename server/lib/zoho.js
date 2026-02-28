const config = require('../config');

let tokenCache = {
  accessToken: null,
  expiresAt: 0,
};

function isConfigured() {
  return !!(config.zoho.clientId && config.zoho.clientSecret && config.zoho.refreshToken);
}

function getAccountsBase() {
  return config.zoho.accountsBase || 'https://accounts.zoho.com';
}

function getApiBase() {
  return config.zoho.apiBase || 'https://www.zohoapis.com';
}

function sanitizeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function getAccessToken() {
  if (!isConfigured()) return null;
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt) return tokenCache.accessToken;

  const tokenUrl = `${getAccountsBase()}/oauth/v2/token`;
  const body = new URLSearchParams({
    refresh_token: config.zoho.refreshToken,
    client_id: config.zoho.clientId,
    client_secret: config.zoho.clientSecret,
    grant_type: 'refresh_token',
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`Zoho token fetch failed (${res.status})`);
  }

  const expiresInSec = Number(data.expires_in || 3600);
  tokenCache.accessToken = data.access_token;
  tokenCache.expiresAt = Date.now() + Math.max(60, expiresInSec - 60) * 1000;
  return tokenCache.accessToken;
}

async function zohoRequest(path, options = {}) {
  const token = await getAccessToken();
  if (!token) return { skipped: true };
  const res = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Zoho API failed (${res.status})`);
  return data;
}

async function upsertCRMContact({ email, fullName, role, phone, lifecycleStage }) {
  if (!email) return { skipped: true };
  if (!isConfigured()) return { skipped: true };
  const payload = {
    data: [
      {
        Email: email,
        Last_Name: fullName || email.split('@')[0] || 'User',
        Phone: phone || undefined,
        Role: role || undefined,
        Lifecycle_Stage: lifecycleStage || undefined,
      },
    ],
    duplicate_check_fields: ['Email'],
    trigger: ['workflow'],
  };
  return zohoRequest('/crm/v2/Contacts/upsert', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function pushBooksInvoice({ email, amount, currency, description }) {
  if (!isConfigured()) return { skipped: true };
  if (!config.zoho.booksOrgId || !config.zoho.booksCustomerId) return { skipped: true };
  const body = {
    customer_id: config.zoho.booksCustomerId,
    currency_code: currency || 'INR',
    reference_number: `LMS-${Date.now()}`,
    line_items: [
      {
        name: description || 'LMS Payment',
        rate: Number(amount || 0),
        quantity: 1,
      },
    ],
    notes: email ? `Payer: ${email}` : undefined,
  };
  return zohoRequest(`/books/v3/invoices?organization_id=${encodeURIComponent(config.zoho.booksOrgId)}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function postCliq(message) {
  const hook = config.zoho.cliqWebhookUrl;
  if (!hook || !message) return { skipped: true };
  const res = await fetch(hook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
  });
  if (!res.ok) throw new Error(`Cliq webhook failed (${res.status})`);
  return { ok: true };
}

async function sendMail({ to, subject, html, fromAddress }) {
  if (!to || !subject) return { skipped: true };
  if (!isConfigured() || !config.zoho.mailAccountId) return { skipped: true };
  const payload = {
    fromAddress: fromAddress || config.zoho.mailFrom || '',
    toAddress: Array.isArray(to) ? to.join(',') : String(to),
    subject: String(subject),
    content: html || '',
    mailFormat: 'html',
  };
  return zohoRequest(`/mail/v1/accounts/${encodeURIComponent(config.zoho.mailAccountId)}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function sendTemplateMail({ to, subject, title, lines }) {
  const safeLines = (Array.isArray(lines) ? lines : []).map((l) => `<li>${sanitizeHtml(l)}</li>`).join('');
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5">
      <h2>${sanitizeHtml(title || 'Vision Connects')}</h2>
      <ul>${safeLines}</ul>
      <p>Regards,<br/>Vision Connects Team</p>
    </div>
  `;
  return sendMail({ to, subject, html });
}

async function dispatchSignAgreement({ name, email, type, externalRef }) {
  if (!email) return { skipped: true };
  if (!isConfigured() || !config.zoho.signTemplateId || !config.zoho.signActionId) return { skipped: true };
  const body = {
    requests: {
      request_name: `${type || 'Agreement'} - ${name || email}`,
      actions: [
        {
          action_id: config.zoho.signActionId,
          recipient_name: name || email,
          recipient_email: email,
          action_type: 'SIGN',
        },
      ],
      notes: `External Ref: ${externalRef || ''}`,
    },
  };
  return zohoRequest(`/sign/v1/templates/${encodeURIComponent(config.zoho.signTemplateId)}/createdocument`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function getWorkDriveDownloadUrl(resourceId) {
  if (!resourceId) return null;
  if (!isConfigured() || !config.zoho.workdriveTeamId) return null;
  const data = await zohoRequest(`/workdrive/api/v1/files/${encodeURIComponent(resourceId)}`);
  return data?.data?.attributes?.download_url || data?.download_url || null;
}

async function createMeeting({ title, agenda, startTimeIso, durationMinutes }) {
  if (!isConfigured() || !config.zoho.meetingZsoid) return { skipped: true };
  const payload = {
    title: title || 'Training Session',
    agenda: agenda || 'Training Session',
    startTime: startTimeIso,
    duration: Number(durationMinutes || 60),
    timezone: config.zoho.meetingTimezone || 'Asia/Kolkata',
  };
  return zohoRequest(`/meeting/api/v2/${encodeURIComponent(config.zoho.meetingZsoid)}/sessions.json`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function createDeskTicket({ subject, description, email, priority }) {
  if (!isConfigured() || !config.zoho.deskOrgId || !config.zoho.deskDepartmentId) return { skipped: true };
  const payload = {
    subject: subject || 'Support request',
    description: description || '',
    email: email || undefined,
    departmentId: config.zoho.deskDepartmentId,
    priority: priority || 'Medium',
    status: 'Open',
    channel: 'Web',
  };
  return zohoRequest('/desk/api/v1/tickets', {
    method: 'POST',
    headers: { orgId: config.zoho.deskOrgId },
    body: JSON.stringify(payload),
  });
}

async function listDeskTickets({ limit = 20, from = 0 } = {}) {
  if (!isConfigured() || !config.zoho.deskOrgId || !config.zoho.deskDepartmentId) return { skipped: true, data: [] };
  const q = `?departmentId=${encodeURIComponent(config.zoho.deskDepartmentId)}&limit=${encodeURIComponent(limit)}&from=${encodeURIComponent(from)}`;
  return zohoRequest(`/desk/api/v1/tickets${q}`, {
    method: 'GET',
    headers: { orgId: config.zoho.deskOrgId },
  });
}

async function pushAnalyticsEvent(event) {
  // Keep this non-blocking unless a fully provisioned Analytics workspace is available.
  if (!isConfigured() || !config.zoho.analyticsWorkspaceId) return { skipped: true };
  return zohoRequest(`/analytics/v2/workspaces/${encodeURIComponent(config.zoho.analyticsWorkspaceId)}/rows`, {
    method: 'POST',
    body: JSON.stringify(event || {}),
  });
}

module.exports = {
  isConfigured,
  upsertCRMContact,
  pushBooksInvoice,
  postCliq,
  sendMail,
  sendTemplateMail,
  dispatchSignAgreement,
  getWorkDriveDownloadUrl,
  createMeeting,
  createDeskTicket,
  listDeskTickets,
  pushAnalyticsEvent,
};

