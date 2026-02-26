/**
 * Global app state: show/hide login vs user menu based on auth.
 * Auth state is determined by server (cookie); we only reflect it in UI.
 */
(function () {
  async function updateNav() {
    const navAuth = document.getElementById('navAuth');
    const navUser = document.getElementById('navUser');
    const userMenuLabel = document.getElementById('userMenuLabel');
    const btnLogout = document.getElementById('btnLogout');

    if (!navAuth || !navUser) return;

    if (!window.api || !window.api.isLoggedIn()) {
      navAuth.classList.remove('d-none');
      navUser.classList.add('d-none');
      document.body.classList.remove('user-logged-in');
      return;
    }

    try {
      const data = await window.api.get('/auth/me');
      navAuth.classList.add('d-none');
      navUser.classList.remove('d-none');
      if (userMenuLabel) userMenuLabel.textContent = data.user?.email || data.user?.role || 'Account';
    } catch (e) {
      navAuth.classList.remove('d-none');
      navUser.classList.add('d-none');
    }
  }

  document.getElementById('btnLogout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await window.api.post('/auth/logout');
      window.location.href = 'index.html';
    } catch (err) {
      window.location.href = 'index.html';
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateNav);
  } else {
    updateNav();
  }
})();
