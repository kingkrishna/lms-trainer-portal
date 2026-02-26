/**
 * Role-aware navigation: hide Jobs from trainers, redirect trainers from jobs page.
 */
(function () {
  function getAuthState(cb) {
    if (typeof window.api === 'undefined' || !window.api.isLoggedIn || !window.api.isLoggedIn()) {
      if (cb) cb({ role: null, isAuthenticated: false });
      return;
    }

    window.api.get('/auth/me')
      .then(function (data) {
        var role = data.user && data.user.role ? data.user.role : null;
        if (cb) cb({ role: role, isAuthenticated: true });
      })
      .catch(function () {
        if (cb) cb({ role: null, isAuthenticated: false });
      });
  }

  function applyRoleNav(role, isAuthenticated) {
    var links = document.querySelectorAll('[data-hide-for="trainer"]');
    if (role === 'trainer' && links.length) {
      links.forEach(function (el) { el.style.display = 'none'; });
    }

    var dashboardLinks = document.querySelectorAll('a[href="dashboard.html"]');
    if (dashboardLinks.length && !isAuthenticated) {
      dashboardLinks.forEach(function (el) { el.style.display = 'none'; });
    }
  }

  getAuthState(function (state) {
    applyRoleNav(state.role, state.isAuthenticated);
    window.__userRole = state.role;
    window.__isAuthenticated = !!state.isAuthenticated;
  });
})();
