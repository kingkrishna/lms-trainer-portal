/**
 * Trainers page: load trainers and render profile cards.
 * Approval status: Approved, Pending, Rejected. Admin can filter by status.
 */

(function () {
  const trainerListEl = document.getElementById('trainerList');
  const trainerCountEl = document.getElementById('trainerCount');
  const trainerSearchEl = document.getElementById('trainerSearch');
  const trainersEmptyEl = document.getElementById('trainersEmpty');
  const statusTabsEl = document.getElementById('trainersStatusTabs');

  if (!trainerListEl) return;

  var currentStatus = 'approved';
  var isAdmin = false;

  var DEMO_TRAINERS = [
    {
      id: 'tr-1',
      slug: 'tr-1',
      full_name: 'Nitin Kumar D',
      bio: 'Specialist trainer for Zoho Books and AI in Accounting workflows.',
      courses: ['Zoho Books', 'AI in Accounting'],
      badge: 'Verified',
      approval_status: 'approved',
    },
    {
      id: 'tr-2',
      full_name: 'Ashok Raju',
      bio: 'Tax trainer focused on GST, Income Tax, and TDS compliance.',
      courses: ['GST', 'Income Tax', 'TDS'],
      badge: 'Popular',
    },
    {
      id: 'tr-3',
      full_name: 'Prasanth',
      bio: 'Taxz trainer for GST, Income Tax, and TDS practical sessions.',
      courses: ['Taxz - GST', 'Income Tax', 'TDS'],
      badge: 'Pro',
    },
    {
      id: 'tr-4',
      full_name: 'Venkatesh',
      bio: 'Core Accounting trainer with focus on strong accounting fundamentals.',
      courses: ['Core Accounting'],
      badge: 'New',
    },
    {
      id: 'tr-5',
      full_name: 'Srinivas',
      bio: 'Tally and GST Simulation trainer for hands-on practical learning.',
      courses: ['Tally', 'GST Simulation'],
    },
    {
      id: 'tr-6',
      full_name: 'JayaShree',
      bio: 'GST Simulation trainer focused on practical workflows and filing scenarios.',
      courses: ['GST Simulation'],
    },
  ];

  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getInitials(name) {
    return (name || '')
      .split(/\s+/)
      .slice(0, 2)
      .map(function (w) { return w.charAt(0); })
      .join('')
      .toUpperCase();
  }

  var courseFromUrl = (function () {
    var p = new URLSearchParams(window.location.search);
    return p.get('course') || '';
  })();

  function renderCard(trainer) {
    var coursesList = (trainer.courses || []).map(function (c) {
      return '<span class="trainer-card-tag">' + escapeHtml(c) + '</span>';
    }).join('');
    var badge = trainer.badge
      ? '<span class="trainer-card-badge">' + escapeHtml(trainer.badge) + '</span>'
      : '';
    var statusBadge = (trainer.approval_status && isAdmin)
      ? '<span class="trainer-card-badge-status ' + escapeHtml(trainer.approval_status) + '">' + escapeHtml(trainer.approval_status) + '</span>'
      : '';
    var slug = (trainer.slug || trainer.id || '').toString();
    var cardHref = courseFromUrl
      ? 'candidate-process.html?course=' + encodeURIComponent(courseFromUrl) + '&trainer=' + encodeURIComponent(slug)
      : 'trainer-detail.html?id=' + encodeURIComponent(slug);
    return (
      '<article class="trainer-card" data-id="' + escapeHtml(trainer.id) + '">' +
        '<a href="' + cardHref + '" class="trainer-card-link">' +
          '<div class="trainer-card-avatar-wrap">' +
            '<span class="trainer-card-avatar">' + getInitials(trainer.full_name) + '</span>' +
            badge + statusBadge +
          '</div>' +
          '<div class="trainer-card-body">' +
            '<h3 class="trainer-card-name">' + escapeHtml(trainer.full_name) + '</h3>' +
            '<p class="trainer-card-bio">' + escapeHtml(trainer.bio || '') + '</p>' +
            '<div class="trainer-card-tags">' + coursesList + '</div>' +
            '<span class="trainer-card-cta">' + (courseFromUrl ? 'Enroll →' : 'View profile →') + '</span>' +
          '</div>' +
        '</a>' +
      '</article>'
    );
  }

  function renderList(trainers) {
    if (!trainers || trainers.length === 0) {
      trainerListEl.innerHTML = '';
      if (trainerCountEl) trainerCountEl.textContent = 'No trainers';
      if (trainersEmptyEl) trainersEmptyEl.classList.remove('d-none');
      return;
    }
    if (trainersEmptyEl) trainersEmptyEl.classList.add('d-none');
    trainerListEl.innerHTML = trainers.map(renderCard).join('');
    if (trainerCountEl) {
      trainerCountEl.textContent = trainers.length === 1
        ? '1 trainer'
        : trainers.length + ' trainers';
    }
  }

  function filterTrainers(trainers, query) {
    if (!query || !query.trim()) return trainers;
    var q = query.trim().toLowerCase();
    return trainers.filter(function (t) {
      var name = (t.full_name || '').toLowerCase();
      var bio = (t.bio || '').toLowerCase();
      var courses = (t.courses || []).join(' ').toLowerCase();
      return name.indexOf(q) !== -1 || bio.indexOf(q) !== -1 || courses.indexOf(q) !== -1;
    });
  }

  var allTrainers = DEMO_TRAINERS.slice();

  function fetchUserRole(cb) {
    if (typeof window.api === 'undefined' || !window.api.isLoggedIn || !window.api.isLoggedIn()) {
      isAdmin = false;
      if (statusTabsEl) statusTabsEl.classList.add('d-none');
      if (cb) cb();
      return;
    }
    window.api.get('/auth/me').then(function (data) {
      isAdmin = data.user && data.user.role === 'super_admin';
      if (statusTabsEl && isAdmin) statusTabsEl.classList.remove('d-none');
      if (cb) cb();
    }).catch(function () {
      if (statusTabsEl) statusTabsEl.classList.add('d-none');
      if (cb) cb();
    });
  }

  function loadTrainers() {
    if (trainersEmptyEl) trainersEmptyEl.classList.add('d-none');
    renderList(filterTrainers(allTrainers, trainerSearchEl ? trainerSearchEl.value : ''));

    if (typeof window.api === 'undefined') return;

    var url = '/trainers';
    if (isAdmin && currentStatus) url += '?status=' + encodeURIComponent(currentStatus);
    window.api.get(url)
      .then(function (data) {
        var list = data;
        if (data && Array.isArray(data.trainers)) list = data.trainers;
        if (Array.isArray(list) && list.length > 0) allTrainers = list;
        renderList(filterTrainers(allTrainers, trainerSearchEl ? trainerSearchEl.value : ''));
      })
      .catch(function () {
        allTrainers = DEMO_TRAINERS.slice();
        renderList(filterTrainers(allTrainers, trainerSearchEl ? trainerSearchEl.value : ''));
      });
  }

  if (statusTabsEl) {
    statusTabsEl.addEventListener('click', function (e) {
      var tab = e.target.closest('.trainers-status-tab');
      if (!tab) return;
      statusTabsEl.querySelectorAll('.trainers-status-tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      currentStatus = tab.getAttribute('data-status') || 'approved';
      loadTrainers();
    });
  }

  if (trainerSearchEl) {
    trainerSearchEl.addEventListener('input', function () {
      renderList(filterTrainers(allTrainers, trainerSearchEl.value));
    });
  }

  fetchUserRole(function () {
    if (statusTabsEl && isAdmin) statusTabsEl.classList.remove('d-none');
    loadTrainers();
  });
})();
