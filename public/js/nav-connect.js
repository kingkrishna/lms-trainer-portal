/**
 * Connects nav across all pages: shows Account dropdown when logged in,
 * Login when logged out. Use on pages with courses-nav, trainers-nav, jobs-nav.
 */
(function () {
  function init() {
    var loginLink = document.querySelector('.courses-nav a[href="login.html"], .trainers-nav a[href="login.html"], .jobs-nav a[href="login.html"]');
    if (!loginLink) return;

    var nav = loginLink.closest('nav');
    if (!nav) return;

    var accountEl = document.getElementById('navAccountWrap');
    if (accountEl) return;

    if (!window.api || !window.api.isLoggedIn) return;

    function showLoggedOut() {
      if (accountEl) accountEl.classList.add('d-none');
      if (loginLink) loginLink.style.display = '';
      var signup = nav.querySelector('a[href="register.html"]');
      if (signup) signup.style.display = '';
    }

    function showLoggedIn(email) {
      if (!accountEl) {
        accountEl = document.createElement('span');
        accountEl.id = 'navAccountWrap';
        accountEl.className = 'nav-account-dropdown';
        accountEl.innerHTML = '<span class="dropdown"><a class="nav-link-dropdown" href="#" data-bs-toggle="dropdown" id="navAccountLabel">Account</a>' +
          '<ul class="dropdown-menu dropdown-menu-end"><li><a class="dropdown-item" href="dashboard.html">Dashboard</a></li>' +
          '<li><a class="dropdown-item" href="profile.html">Profile</a></li><li><hr class="dropdown-divider"></li>' +
          '<li><a class="dropdown-item" href="#" id="btnNavLogout">Log out</a></li></ul></span>';
        accountEl.style.display = 'inline-flex';
        loginLink.parentNode.insertBefore(accountEl, loginLink);
        accountEl.querySelector('#btnNavLogout').addEventListener('click', function (e) {
          e.preventDefault();
          try { localStorage.removeItem('lms_demo_user'); } catch (_) {}
          if (window.api && window.api.post) window.api.post('/auth/logout').catch(function () {});
          window.location.href = 'index.html';
        });
      }
      var label = document.getElementById('navAccountLabel');
      if (label) label.textContent = (email && email.length > 25 ? email.slice(0, 22) + '…' : email) || 'Account';
      accountEl.classList.remove('d-none');
      loginLink.style.display = 'none';
      var signup = nav.querySelector('a[href="register.html"]');
      if (signup) signup.style.display = 'none';
    }

    if (!window.api.isLoggedIn()) return;

    window.api.get('/auth/me').then(function (data) {
      showLoggedIn(data.user && data.user.email);
    }).catch(showLoggedOut);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
