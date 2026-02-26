/**
 * Google Sign-In integration.
 * Fetches client ID from API, loads GIS, handles credential.
 */
(function () {
  const API_BASE = window.API_BASE || '/api';

  window.initGoogleAuth = function (opts) {
    opts = opts || {};
    const onSuccess = opts.onSuccess || function () { window.location.href = 'dashboard.html'; };
    const onError = opts.onError || function (msg) { console.error(msg); };
    const getRole = opts.getRole || function () { return null; };

    function renderAndInit(clientId) {
      if (!clientId) return;
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = function () {
        if (typeof google !== 'undefined' && google.accounts) {
          google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredential,
            auto_select: false,
          });
          var btn = document.getElementById('googleSignInBtn');
          if (btn && google.accounts.id) {
            google.accounts.id.renderButton(btn, {
              type: 'standard',
              theme: 'outline',
              size: 'large',
              text: opts.buttonText || 'signin_with',
              width: opts.buttonWidth || 280,
            });
          }
          var btnDiv = document.getElementById('googleSignInContainer');
          if (btnDiv && !btn) {
            var innerBtn = document.createElement('div');
            innerBtn.id = 'googleSignInBtn';
            btnDiv.appendChild(innerBtn);
            google.accounts.id.renderButton(innerBtn, {
              type: 'standard',
              theme: 'outline',
              size: 'large',
              text: opts.buttonText || 'signin_with',
              width: opts.buttonWidth || 280,
            });
          }
        }
      };
      document.head.appendChild(script);
    }

    function handleCredential(response) {
      if (!response || !response.credential) {
        onError('No credential received');
        return;
      }
      var role = getRole();
      var body = { credential: response.credential };
      if (role) body.role = role;

      fetch(API_BASE + '/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
        .then(function (r) {
          return r.text().then(function (text) {
            var data = {};
            try { data = text ? JSON.parse(text) : {}; } catch (_) {}
            if (!r.ok) {
              if (!data.error && (r.status === 404 || r.status === 502)) data.error = 'Backend not available. Use demo login below.';
              throw data;
            }
            onSuccess(data);
          });
        })
        .catch(function (err) {
          var msg = (err && err.error) || (err && err.message) || 'Google sign-in failed';
          if (err && (err.status === 0 || err.message === 'Failed to fetch')) msg = 'Backend not available. Use demo login or email/password.';
          if (err && (err.message && err.message.includes('JSON'))) msg = 'Backend not available. Google sign-in needs the server running. Use demo login below.';
          onError(msg);
        });
    }

    var fallbackClientId = window.GOOGLE_CLIENT_ID || '';

    fetch(API_BASE + '/auth/config')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var id = (data && data.googleClientId) || fallbackClientId;
        if (id) renderAndInit(id);
        else showServerRequired();
      })
      .catch(function () {
        if (fallbackClientId) {
          renderAndInit(fallbackClientId);
        } else {
          showServerRequired();
        }
      });

    function showServerRequired() {
      var container = document.getElementById('googleSignInContainer');
      if (container) container.innerHTML = '<p class="small text-muted">Google sign-in requires the server. Run <code>npm start</code> and open <a href="/login">localhost:3000/login</a>. Or use demo/email login.</p>';
    }
  };
})();
