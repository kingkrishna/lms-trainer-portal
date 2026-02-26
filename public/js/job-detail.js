/**
 * Job detail page: show one job by id (from query).
 */

(function () {
  var params = new URLSearchParams(window.location.search);
  var id = params.get('id');
  var contentEl = document.getElementById('jobDetailContent');
  var breadcrumbEl = document.getElementById('breadcrumbTitle');

  var DEMO_JOBS = {
    'job-1': {
      id: 'job-1',
      title: 'Junior Accountant',
      company: 'ABC & Co. Chartered Accountants',
      location: 'Mumbai, Maharashtra',
      job_type: 'full_time',
      description: 'Handle day-to-day bookkeeping, bank reconciliation, and assist in financial statements. Tally experience preferred.\n\nRequirements: B.Com or equivalent; 0–2 years experience. Good communication and attention to detail.',
    },
    'job-2': {
      id: 'job-2',
      title: 'Tax Associate',
      company: 'XYZ Tax Consultants',
      location: 'Bangalore, Karnataka',
      job_type: 'full_time',
      description: 'Income tax and GST compliance, return filing, and client support. Fresh CAs and commerce graduates welcome.\n\nRequirements: CA/CMA/B.Com. Knowledge of tax software and Excel. Willing to learn and work in a team.',
    },
    'job-3': {
      id: 'job-3',
      title: 'Audit Trainee',
      company: 'Grant & Partners',
      location: 'Delhi NCR',
      job_type: 'full_time',
      description: 'Support statutory and internal audit engagements. CA Inter / Final students can apply.\n\nRequirements: CA Inter cleared. Good understanding of auditing standards and documentation.',
    },
    'job-4': {
      id: 'job-4',
      title: 'Tally Operator',
      company: 'Retail Solutions Pvt Ltd',
      location: 'Chennai, Tamil Nadu',
      job_type: 'full_time',
      description: 'Maintain accounts in Tally, GST returns, and vendor reconciliation. 1–2 years experience.\n\nRequirements: B.Com with Tally certification or equivalent experience. Familiarity with GST portal.',
    },
    'job-5': {
      id: 'job-5',
      title: 'Finance Intern',
      company: 'ScaleUp Ventures',
      location: 'Remote',
      job_type: 'internship',
      description: 'Assist in financial reporting, variance analysis, and dashboards. MBA/CA students preferred.\n\nRequirements: Pursuing or completed MBA (Finance) / CA. Excel and basic financial modelling. 3–6 months commitment.',
    },
    'job-6': {
      id: 'job-6',
      title: 'Accounts Executive',
      company: 'Metro Manufacturing Ltd',
      location: 'Pune, Maharashtra',
      job_type: 'full_time',
      description: 'Cost accounting, inventory, and month-end closing. CMA or B.Com with 2+ years experience.\n\nRequirements: CMA/B.Com with cost accounting experience. ERP exposure is a plus.',
    },
    'job-7': {
      id: 'job-7',
      title: 'Part-time Bookkeeper',
      company: 'Small Business Services',
      location: 'Hyderabad, Telangana',
      job_type: 'part_time',
      description: 'Bookkeeping and payroll for multiple clients. Flexible hours. Tally knowledge required.\n\nRequirements: 2+ years bookkeeping experience. Reliable and able to work independently.',
    },
  };

  function getJobTypeLabel(type) {
    var map = { full_time: 'Full-time', part_time: 'Part-time', internship: 'Internship', contract: 'Contract' };
    return map[type] || type || 'Full-time';
  }

  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function render(job, opts) {
    opts = opts || {};
    if (!job) {
      contentEl.innerHTML = '<div class="job-detail-loading">Job not found. <a href="jobs.html">Back to jobs</a>.</div>';
      if (breadcrumbEl) breadcrumbEl.textContent = 'Not found';
      return;
    }
    if (breadcrumbEl) breadcrumbEl.textContent = job.title;
    var typeLabel = getJobTypeLabel(job.job_type);
    var isStudent = opts.role === 'student';
    var applied = opts.applied || false;
    var applyHtml = '';
    if (applied) {
      applyHtml = '<span class="btn btn-apply-now btn-secondary disabled">Already applied</span>';
    } else if (isStudent) {
      applyHtml = '<button type="button" class="btn btn-apply-now" id="btnApplyJob">Apply now</button>';
    } else {
      applyHtml = '<a href="login.html?redirect=' + encodeURIComponent('job-detail.html?id=' + job.id) + '" class="btn btn-apply-now">Log in to apply</a>';
    }
    contentEl.innerHTML =
      '<div class="job-detail-card">' +
        '<div class="job-detail-hero">' +
          '<span class="job-detail-type">' + escapeHtml(typeLabel) + '</span>' +
          '<h1 class="job-detail-title">' + escapeHtml(job.title) + '</h1>' +
          '<p class="job-detail-company">' + escapeHtml(job.company || '') + '</p>' +
          '<p class="job-detail-location">' + escapeHtml(job.location || '') + '</p>' +
        '</div>' +
        '<div class="job-detail-body">' +
          '<div class="job-detail-section">' +
            '<h4>Description</h4>' +
            '<p class="job-detail-desc">' + escapeHtml(job.description || '') + '</p>' +
          '</div>' +
          '<div class="job-detail-section" id="applyCoverSection" style="display:none">' +
            '<label class="form-label">Cover message (optional)</label>' +
            '<textarea class="form-control" id="applyCoverMessage" rows="3" placeholder="Why are you a good fit?"></textarea>' +
          '</div>' +
          '<div class="job-detail-actions">' +
            applyHtml +
            '<a href="jobs.html" class="btn btn-back-jobs">← All jobs</a>' +
          '</div>' +
          '<p class="job-detail-note">Students can apply directly. Recruiters manage applications below.</p>' +
          '<div id="jobApplicationsSection" class="mt-4" style="display:none"></div>' +
        '</div>' +
      '</div>';

    var btn = document.getElementById('btnApplyJob');
    if (btn && typeof window.api !== 'undefined') {
      btn.addEventListener('click', function () {
        var cover = document.getElementById('applyCoverMessage');
        var coverMsg = cover ? cover.value.trim() : '';
        btn.disabled = true;
        btn.textContent = 'Submitting…';
        window.api.post('/jobs/' + encodeURIComponent(job.id) + '/apply', { cover_message: coverMsg })
          .then(function () {
            btn.textContent = 'Applied ✓';
            btn.classList.add('btn-secondary', 'disabled');
            btn.disabled = true;
          })
          .catch(function (err) {
            btn.disabled = false;
            btn.textContent = 'Apply now';
            alert(err.error || 'Apply failed');
          });
      });
    }
  }

  if (!id) {
    render(null);
    return;
  }

  function loadApplications(jobId, role) {
    var section = document.getElementById('jobApplicationsSection');
    if (!section || (role !== 'recruiter' && role !== 'super_admin')) return;
    if (typeof window.api === 'undefined') return;
    window.api.get('/jobs/' + encodeURIComponent(jobId) + '/applications')
      .then(function (data) {
        var apps = data.applications || [];
        if (apps.length === 0) {
          section.innerHTML = '<h4 class="h5 mt-3">Applications</h4><p class="text-muted">No applications yet.</p>';
        } else {
          section.innerHTML = '<h4 class="h5 mt-3">Applications (' + apps.length + ')</h4>' +
            '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Candidate</th><th>Contact</th><th>Skills</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
            apps.map(function (a) {
              var skills = Array.isArray(a.student_skills) ? a.student_skills.join(', ') : (a.student_skills || '');
              return '<tr><td>' + escapeHtml(a.student_name) + '</td><td>' + escapeHtml(a.student_phone || '') + '</td><td>' + escapeHtml(skills) + '</td><td><span class="badge bg-secondary">' + escapeHtml(a.status) + '</span></td><td><button type="button" class="btn btn-sm btn-outline-primary me-1" data-action="shortlist" data-app-id="' + escapeHtml(a.id) + '">Shortlist</button><button type="button" class="btn btn-sm btn-outline-danger" data-action="reject" data-app-id="' + escapeHtml(a.id) + '">Reject</button></td></tr>';
            }).join('') + '</tbody></table></div>';
          section.querySelectorAll('[data-action]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              var appId = btn.dataset.appId;
              var status = btn.dataset.action === 'shortlist' ? 'shortlisted' : 'rejected';
              window.api.patch('/jobs/applications/' + appId + '/status', { status: status }).then(function () {
                loadApplications(jobId, role);
              }).catch(function (e) { alert(e.error || 'Failed'); });
            });
          });
        }
        section.style.display = 'block';
      })
      .catch(function () {
        section.innerHTML = '';
        section.style.display = 'none';
      });
  }

  function loadAndRender() {
    var jobPromise = (typeof window.api !== 'undefined')
      ? window.api.get('/jobs/' + encodeURIComponent(id)).catch(function () { return null; })
      : Promise.resolve(null);
    var mePromise = (typeof window.api !== 'undefined' && window.api.isLoggedIn && window.api.isLoggedIn())
      ? window.api.get('/auth/me').catch(function () { return null; })
      : Promise.resolve(null);
    var myAppsPromise = (typeof window.api !== 'undefined' && window.api.isLoggedIn && window.api.isLoggedIn())
      ? window.api.get('/jobs/my/applications').catch(function () { return { applications: [] }; })
      : Promise.resolve({ applications: [] });

    Promise.all([jobPromise, mePromise, myAppsPromise]).then(function (results) {
      var job = results[0] && results[0].id ? results[0] : (DEMO_JOBS[id] || null);
      var me = results[1];
      var myApps = results[2] || { applications: [] };
      var role = me && me.user ? me.user.role : null;
      var applied = (myApps.applications || []).some(function (a) {
        return a.job_id === id || (job && a.job_id === job.id);
      });
      render(job, { role: role, applied: applied });
      if (role === 'recruiter' || role === 'super_admin') loadApplications(id, role);
    });
  }

  loadAndRender();
})();
