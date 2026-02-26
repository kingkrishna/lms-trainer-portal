/**
 * Trainer detail page: show one trainer by id (from query).
 */

(function () {
  var params = new URLSearchParams(window.location.search);
  var id = params.get('id');
  var contentEl = document.getElementById('trainerDetailContent');
  var breadcrumbEl = document.getElementById('breadcrumbName');

  var DEMO_TRAINERS = {
    'tr-1': {
      id: 'tr-1',
      full_name: 'Nitin Kumar D',
      bio: 'Focused on Zoho Books and AI in Accounting with practical business use cases.',
      courses: ['Zoho Books', 'AI in Accounting'],
      badge: 'Verified',
    },
    'tr-2': {
      id: 'tr-2',
      full_name: 'Ashok Raju',
      bio: 'Tax trainer for GST, Income Tax, and TDS with compliance-first learning.',
      courses: ['GST', 'Income Tax', 'TDS'],
      badge: 'Popular',
    },
    'tr-3': {
      id: 'tr-3',
      full_name: 'Prasanth',
      bio: 'Taxz instructor covering GST, Income Tax, and TDS through practical sessions.',
      courses: ['Taxz - GST', 'Income Tax', 'TDS'],
      badge: 'Pro',
    },
    'tr-4': {
      id: 'tr-4',
      full_name: 'Venkatesh',
      bio: 'Core Accounting trainer focused on fundamentals and day-to-day accounting accuracy.',
      courses: ['Core Accounting'],
      badge: 'New',
    },
    'tr-5': {
      id: 'tr-5',
      full_name: 'Srinivas',
      bio: 'Specialized trainer for Tally and GST Simulation with practical workflow coverage.',
      courses: ['Tally', 'GST Simulation'],
    },
    'tr-6': {
      id: 'tr-6',
      full_name: 'JayaShree',
      bio: 'GST Simulation trainer focused on practical workflows and filing scenarios.',
      courses: ['GST Simulation'],
    },
  };

  function getInitials(name) {
    return (name || '').split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase();
  }

  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function render(trainer) {
    if (!trainer) {
      contentEl.innerHTML = '<div class="trainer-detail-loading">Trainer not found. <a href="trainers.html">Back to trainers</a>.</div>';
      if (breadcrumbEl) breadcrumbEl.textContent = 'Not found';
      return;
    }
    if (breadcrumbEl) breadcrumbEl.textContent = trainer.full_name;
    var tags = (trainer.courses || []).map(function (c) {
      return '<span class="trainer-detail-tag">' + escapeHtml(c) + '</span>';
    }).join('');
    var enrollHref = 'candidate-process.html?trainer=' + encodeURIComponent(trainer.id);
    var coursesCount = (trainer.courses || []).length;
    var aboutText = trainer.bio || 'Experienced trainer focused on practical outcomes and career readiness.';
    contentEl.innerHTML =
      '<div class="trainer-detail-card">' +
        '<div class="trainer-detail-hero">' +
          '<div class="trainer-detail-hero-inner">' +
            '<span class="trainer-detail-avatar">' + getInitials(trainer.full_name) + '</span>' +
            '<div class="trainer-detail-hero-copy">' +
              '<h1 class="trainer-detail-name">' + escapeHtml(trainer.full_name) + '</h1>' +
              '<p class="trainer-detail-subtitle">Accounting and finance trainer</p>' +
              '<div class="trainer-detail-hero-meta">' +
                (trainer.badge ? '<span class="trainer-detail-badge">' + escapeHtml(trainer.badge) + '</span>' : '') +
                '<span class="trainer-detail-chip">' + coursesCount + (coursesCount === 1 ? ' course' : ' courses') + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="trainer-detail-body">' +
          '<section class="trainer-detail-main-content">' +
            '<div class="trainer-detail-section">' +
              '<h4>About trainer</h4>' +
              '<p class="trainer-detail-bio">' + escapeHtml(aboutText) + '</p>' +
            '</div>' +
            '<div class="trainer-detail-section">' +
              '<h4>Courses taught</h4>' +
              '<div class="trainer-detail-tags">' + tags + '</div>' +
            '</div>' +
            '<div class="trainer-detail-actions">' +
              '<a href="' + enrollHref + '" class="btn btn-choose-course" id="btnEnrollTrainer" data-enroll-href="' + escapeHtml(enrollHref) + '">Enroll with this trainer</a>' +
              '<a href="trainers.html" class="btn btn-back-trainers">View all trainers</a>' +
            '</div>' +
          '</section>' +
          '<aside class="trainer-detail-side-panel">' +
            '<div class="trainer-highlight-card">' +
              '<h5>Profile highlights</h5>' +
              '<ul class="trainer-highlight-list">' +
                '<li>Structured course roadmap</li>' +
                '<li>Practice-oriented sessions</li>' +
                '<li>Career-focused guidance</li>' +
              '</ul>' +
            '</div>' +
            '<div class="trainer-highlight-card">' +
              '<h5>Best fit for</h5>' +
              '<p>Students and professionals who want practical accounting skills and job readiness.</p>' +
            '</div>' +
          '</aside>' +
        '</div>' +
      '</div>';

    var enrollBtn = contentEl.querySelector('#btnEnrollTrainer');
    if (enrollBtn) {
      enrollBtn.addEventListener('click', function (e) {
        if (typeof window.api !== 'undefined' && window.api.isLoggedIn && !window.api.isLoggedIn()) {
          e.preventDefault();
          var dest = this.getAttribute('data-enroll-href') || this.getAttribute('href') || enrollHref;
          window.location.href = 'login.html?redirect=' + encodeURIComponent(dest);
        }
      });
    }
  }

  if (!id) {
    render(null);
    return;
  }

  if (typeof window.api !== 'undefined') {
    window.api.get('/trainers/' + encodeURIComponent(id))
      .then(function (data) {
        render(data && data.id ? data : (DEMO_TRAINERS[id] || null));
      })
      .catch(function () {
        render(DEMO_TRAINERS[id] || null);
      });
  } else {
    render(DEMO_TRAINERS[id] || null);
  }
})();
