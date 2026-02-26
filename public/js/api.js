/**
 * API client – frontend only consumes APIs.
 * No pricing logic, no access control – server is the authority.
 */
(function () {
  // When using Live Server (5500), API runs on port 3000
  if (!window.API_BASE && typeof location !== 'undefined' && (location.port === '5500' || location.port === '5501')) {
    window.API_BASE = location.protocol + '//' + location.hostname + ':3000/api';
  }
  const API_BASE = window.API_BASE || '/api';

  function getCookie(name) {
    const v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
    return v ? v[2] : null;
  }

  async function request(method, path, body = null, opts = {}) {
    const url = path.startsWith('http') ? path : API_BASE + path;
    const headers = {
      'Content-Type': 'application/json',
      ...opts.headers,
    };
    const config = { method, headers, credentials: 'include' };
    if (body && method !== 'GET') config.body = JSON.stringify(body);
    const res = await fetch(url, config);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { status: res.status, ...data };
    return data;
  }

  window.api = {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    delete: (path) => request('DELETE', path),
    // lms_token is HttpOnly so JS can't read it; lms_ok is set by server for client-side check
    isLoggedIn: () => !!getCookie('lms_ok') || !!getCookie('lms_token'),
  };
})();
