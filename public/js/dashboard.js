/**
 * Dashboard – role-specific layouts (Student, Trainer, Recruiter, Admin)
 */

(function () {
  const el = document.getElementById('dashboardContent');
  const welcomeEl = document.querySelector('.dash-welcome');
  const quicklinksEl = document.querySelector('.dash-quicklinks');
  if (!el) return;

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  const DEMO_NOTE = '<p class="dash-demo-badge">Demo mode – run <code>npm start</code> with MySQL for full features.</p>';

  const DASHBOARDS = {
    student: function (user) {
      const name = user.full_name || user.email || 'Student';
      const profileImg = user.profile_image_url || '';
      let skills = [];
      if (user.skills) {
        if (Array.isArray(user.skills)) skills = user.skills;
        else if (typeof user.skills === 'string') { try { skills = JSON.parse(user.skills || '[]'); } catch (_) { skills = user.skills.split(',').map(function (s) { return s.trim(); }).filter(Boolean); } }
      }
      const hasResume = !!user.resume_url;
      const profileItems = [
        !!user.full_name,
        !!user.phone,
        !!user.address,
        !!profileImg,
        hasResume,
        skills.length > 0,
      ];
      const completeness = Math.round((profileItems.filter(Boolean).length / 6) * 100);

      return {
        welcome: { title: 'My profile', sub: 'Get discovered by recruiters. Complete your profile to appear in candidate search.' },
        content: `
          <div class="dash-role dash-student dash-student-linkedin">
            <div class="dash-student-hero">
              <div class="dash-student-cover"></div>
              <div class="dash-student-profile-card">
                <div class="dash-student-avatar-wrap">
                  <img src="${profileImg || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'80\' height=\'80\' viewBox=\'0 0 24 24\' fill=\'%239ca3af\'%3E%3Cpath d=\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\'/%3E%3C/svg%3E'}" alt="${escapeHtml(name)}" class="dash-student-avatar" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2780%27 height=%2780%27 viewBox=%270 0 24 24%27 fill=%27%239ca3af%27%3E%3Cpath d=%27M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z%27/%3E%3C/svg%3E'" />
                  <span class="dash-student-badge">Open to work</span>
                </div>
                <h2 class="dash-student-name">${escapeHtml(name)}</h2>
                <p class="dash-student-headline">${escapeHtml(user.email || '')}</p>
              </div>
            </div>

            <div class="dash-student-profile-strength">
              <div class="dash-profile-strength-header">
                <strong>Profile strength</strong>
                <span>${completeness}%</span>
              </div>
              <div class="dash-profile-strength-bar">
                <div class="dash-profile-strength-fill" style="width:${completeness}%"></div>
              </div>
              <p class="dash-profile-strength-hint">Complete your profile to get 3× more profile views from recruiters.</p>
              <a href="profile.html" class="dash-profile-strength-cta">Complete profile →</a>
            </div>

            <div class="dash-student-stats">
              <div class="dash-stat-card">
                <span class="dash-stat-num">0</span>
                <span class="dash-stat-label">Profile views</span>
                <span class="dash-stat-sub">by recruiters</span>
              </div>
              <div class="dash-stat-card">
                <span class="dash-stat-num">0</span>
                <span class="dash-stat-label">In search</span>
                <span class="dash-stat-sub">recruiters searching</span>
              </div>
              <div class="dash-stat-card">
                <span class="dash-stat-num">0</span>
                <span class="dash-stat-label">Courses done</span>
                <span class="dash-stat-sub">skills built</span>
              </div>
              <div class="dash-stat-card">
                <span class="dash-stat-num">0</span>
                <span class="dash-stat-label">Applications</span>
                <span class="dash-stat-sub">jobs applied</span>
              </div>
            </div>

            <div class="dash-student-grid">
              <div class="dash-student-main">
                <div class="dash-panel dash-panel-student">
                  <h3 class="dash-panel-title">👀 Recruiters viewing your profile</h3>
                  <p class="dash-panel-desc">When recruiters search for candidates like you, they see your profile here. Complete profile + add skills to get noticed.</p>
                  <div class="dash-recruiter-placeholder">
                    <span class="dash-recruiter-icon">🔍</span>
                    <p>Recruiters search students by skills, courses & profile. Complete your profile to appear in search.</p>
                    <a href="profile.html" class="dash-panel-cta">Add skills & resume →</a>
                  </div>
                </div>
                <div class="dash-panel dash-panel-student">
                  <h3 class="dash-panel-title">🎯 Jobs matching your profile</h3>
                  <p class="dash-panel-desc">Jobs that recruiters posted – matched to your skills & courses.</p>
                  <div class="dash-jobs-placeholder">
                    <p>Add skills in your profile to get job recommendations.</p>
                    <a href="jobs.html" class="dash-panel-cta">Browse all jobs →</a>
                  </div>
                </div>
                <div class="dash-panel dash-panel-student">
                  <h3 class="dash-panel-title">📚 My courses</h3>
                  <p class="dash-panel-desc">Courses you've enrolled in. Complete them to boost your profile.</p>
                  <div id="dashMyCoursesList" class="dash-my-courses-list">Loading...</div>
                  <a href="courses.html?filter=my" class="dash-panel-cta mt-2">View all my courses →</a>
                </div>
              </div>
              <div class="dash-student-sidebar">
                <div class="dash-panel dash-panel-student">
                  <h3 class="dash-panel-title">🛠️ Your skills</h3>
                  <p class="dash-panel-desc">Recruiters search by these. Add more to get discovered.</p>
                  ${skills.length > 0 ? '<div class="dash-skills-list">' + skills.slice(0, 8).map(function (s) { return '<span class="dash-skill-tag">' + escapeHtml(typeof s === 'string' ? s : s.name || s) + '</span>'; }).join('') + '</div>' : '<p class="dash-panel-muted">No skills yet. Add in <a href="profile.html">Profile</a>.</p>'}
                  <a href="profile.html" class="dash-panel-cta small">Edit skills →</a>
                </div>
                <div class="dash-panel dash-panel-student">
                  <h3 class="dash-panel-title">📄 Resume</h3>
                  <p class="dash-panel-desc">Upload resume so recruiters can download it.</p>
                  ${hasResume ? '<p class="dash-panel-success">✓ Resume uploaded</p>' : '<p class="dash-panel-muted">Not uploaded yet.</p><a href="profile.html" class="dash-panel-cta">Upload resume →</a>'}
                </div>
                <div class="dash-panel dash-panel-student dash-panel-highlight">
                  <h3 class="dash-panel-title">💡 Reverse job search</h3>
                  <p class="dash-panel-desc">Unlike other platforms – here <strong>recruiters search for you</strong>. Complete profile, add skills & courses to get found.</p>
                </div>
              </div>
            </div>
            ${DEMO_NOTE}
          </div>
        `,
        quicklinks: [
          { href: 'profile.html', icon: '👤', label: 'Complete profile' },
          { href: 'courses.html?filter=my', icon: '📚', label: 'View my courses' },
          { href: 'jobs.html', icon: '💼', label: 'View jobs' },
          { href: 'messages.html', icon: '✉️', label: 'Messages' },
          { href: 'trainers.html', icon: '👨‍🏫', label: 'Find trainers' },
        ],
      };
    },
    trainer: function (user) {
      return {
        welcome: { title: 'Trainer hub', sub: 'Manage your courses, students, and sessions.' },
        content: `
          <div class="dash-role dash-trainer">
            <div class="dash-trainer-enroll-wrap mb-3">
              <button type="button" class="btn btn-primary" id="btnEnrollTrainee">Enroll as Trainee</button>
            </div>
            <div class="dash-panel mb-3" id="trainerEnrollmentsPanel">
              <h3 class="dash-panel-title">📋 My enrollments</h3>
              <div id="trainerEnrollmentsList" class="dash-panel-muted">Loading...</div>
            </div>
            <div class="dash-status-banner dash-status-pending">
              <span class="dash-status-icon">⏳</span>
              <div>
                <strong>Approval pending</strong>
                <p>Your trainer profile is under review. Super Admin will approve soon.</p>
              </div>
            </div>
            <div class="dash-stats-row">
              <div class="dash-stat-card">
                <span class="dash-stat-num">0</span>
                <span class="dash-stat-label">Courses</span>
              </div>
              <div class="dash-stat-card">
                <span class="dash-stat-num">0</span>
                <span class="dash-stat-label">Students</span>
              </div>
              <div class="dash-stat-card">
                <span class="dash-stat-num">0</span>
                <span class="dash-stat-label">Sessions</span>
              </div>
            </div>
            <div class="dash-cards-grid">
              <div class="dash-panel">
                <h3 class="dash-panel-title">📖 My courses</h3>
                <p class="dash-panel-desc">Courses you teach. Add more after approval.</p>
                <a href="courses.html" class="dash-panel-cta">View courses →</a>
              </div>
              <div class="dash-panel">
                <h3 class="dash-panel-title">📅 Upcoming sessions</h3>
                <p class="dash-panel-desc">One-on-one and group sessions.</p>
                <span class="dash-panel-muted">No sessions scheduled</span>
              </div>
              <div class="dash-panel">
                <h3 class="dash-panel-title">👥 Student enquiries</h3>
                <p class="dash-panel-desc">Students interested in your courses.</p>
                <span class="dash-panel-muted">None yet</span>
              </div>
            </div>
            ${DEMO_NOTE}
          </div>
        `,
        quicklinks: [
          { href: 'courses.html', icon: '📖', label: 'My courses' },
          { href: 'trainers.html', icon: '👤', label: 'Trainer directory' },
          { href: 'index.html', icon: '◇', label: 'Home' },
        ],
      };
    },
    recruiter: function (user) {
      const company = user.company_name || 'Your company';
      const hasAccess = !!user.has_paid_access;
      return {
        welcome: { title: 'Recruiter dashboard', sub: hasAccess ? 'Post jobs, manage applications, and find candidates.' : 'Pay the access fee to unlock candidate search and job posting.' },
        content: `
          <div class="dash-role dash-recruiter">
            ${!hasAccess ? '<div class="dash-status-banner dash-status-warning mb-3" id="recruiterAccessBanner"><span class="dash-status-icon">💳</span><div><strong>Recruiter access required</strong><p>Pay the access fee to post jobs and search candidates.</p><button type="button" class="btn btn-primary btn-sm mt-2" id="btnPayRecruiterAccess">Pay access fee</button></div></div>' : '<div class="dash-status-banner dash-status-success mb-3"><span class="dash-status-icon">✓</span><div><strong>Access active</strong><p>You can post jobs and search candidates.</p></div></div>'}
            <div class="dash-stats-row">
              <div class="dash-stat-card">
                <span class="dash-stat-num">0</span>
                <span class="dash-stat-label">Jobs posted</span>
              </div>
              <div class="dash-stat-card">
                <span class="dash-stat-num">0</span>
                <span class="dash-stat-label">Applications</span>
              </div>
              <div class="dash-stat-card">
                <span class="dash-stat-num">0</span>
                <span class="dash-stat-label">Shortlisted</span>
              </div>
            </div>
            <div class="dash-cards-grid">
              <div class="dash-panel">
                <h3 class="dash-panel-title">📋 Active jobs</h3>
                <p class="dash-panel-desc">Jobs you've posted. Create new ones after access.</p>
                <a href="jobs.html" class="dash-panel-cta">View jobs →</a>
              </div>
              <div class="dash-panel">
                <h3 class="dash-panel-title">📥 Recent applications</h3>
                <p class="dash-panel-desc">Latest candidate applications.</p>
                <span class="dash-panel-muted">No applications yet</span>
              </div>
              <div class="dash-panel">
                <h3 class="dash-panel-title">🔍 Candidate search</h3>
                <p class="dash-panel-desc">Search students by skills and course completion.</p>
                <span class="dash-panel-muted">Available after access</span>
              </div>
            </div>
            ${DEMO_NOTE}
          </div>
        `,
        quicklinks: [
          { href: 'candidates.html', icon: '🔍', label: 'Search candidates' },
          { href: 'jobs.html', icon: '📋', label: 'Post a job' },
          { href: 'jobs.html', icon: '📥', label: 'Applications' },
          { href: 'index.html', icon: '◇', label: 'Home' },
        ],
      };
    },
    super_admin: function (user) {
      return {
        welcome: { title: 'Admin control panel', sub: 'Platform settings, users, and payments.' },
        content: `
          <div class="dash-role dash-admin">
            <div class="dash-panel dash-panel-full mb-3" id="adminTrainersPanel">
              <h3 class="dash-panel-title">👤 Pending trainers</h3>
              <p class="dash-panel-desc">Approve or reject trainer applications.</p>
              <div class="dash-admin-enrollments"><p class="dash-panel-muted">Loading...</p></div>
            </div>
            <div class="dash-panel dash-panel-full mb-3" id="adminEnrollmentsPanel">
              <h3 class="dash-panel-title">📋 Trainer enrollments</h3>
              <p class="dash-panel-desc">All trainee enrollments by trainers.</p>
              <div id="adminEnrollmentsList" class="dash-admin-enrollments"><p class="dash-panel-muted">Loading...</p></div>
            </div>
            <div class="dash-admin-grid">
              <div class="dash-admin-card">
                <span class="dash-admin-icon">👥</span>
                <h3>Users</h3>
                <p>Manage students, trainers, recruiters.</p>
                <span class="dash-admin-stat">—</span>
              </div>
              <div class="dash-admin-card">
                <span class="dash-admin-icon">📚</span>
                <h3>Courses</h3>
                <p>Add courses, set pricing.</p>
                <span class="dash-admin-stat">—</span>
              </div>
              <div class="dash-admin-card">
                <span class="dash-admin-icon">💳</span>
                <h3>Payments</h3>
                <p>Revenue, refunds, webhooks.</p>
                <span class="dash-admin-stat">—</span>
              </div>
              <div class="dash-admin-card">
                <span class="dash-admin-icon">⚙️</span>
                <h3>Settings</h3>
                <p>Commission, platform config.</p>
                <span class="dash-admin-stat">—</span>
              </div>
            </div>
            <div class="dash-panel dash-panel-full">
              <h3 class="dash-panel-title">Platform overview</h3>
              <p class="dash-panel-desc">Full admin features require the backend. Use the API for user management, course pricing, and payment verification.</p>
            </div>
            ${DEMO_NOTE}
          </div>
        `,
        quicklinks: [
          { href: 'courses.html', icon: '📚', label: 'Courses' },
          { href: 'trainers.html', icon: '👤', label: 'Trainers' },
          { href: 'jobs.html', icon: '💼', label: 'Jobs' },
          { href: 'index.html', icon: '◇', label: 'Home' },
        ],
      };
    },
  };

  function renderQuicklinks(links) {
    const row = document.getElementById('dashQuicklinksRow');
    if (!row) return;
    const html = (links || []).map(function (l) {
      return (
        '<div class="col-sm-6 col-md-3">' +
          '<a href="' + escapeHtml(l.href) + '" class="dash-quick-card">' +
            '<span class="dash-quick-icon">' + escapeHtml(l.icon) + '</span>' +
            '<span class="dash-quick-label">' + escapeHtml(l.label) + '</span>' +
          '</a>' +
        '</div>'
      );
    }).join('');
    row.innerHTML = html;
  }

  function renderDashboard(user, role) {
    document.body.classList.remove('dash-role-student', 'dash-role-trainer', 'dash-role-recruiter', 'dash-role-admin');
    document.body.classList.add('dash-role-' + (role === 'super_admin' ? 'admin' : role));

    const fn = DASHBOARDS[role] || DASHBOARDS.student;
    const dash = fn(user);

    if (welcomeEl) {
      const titleEl = welcomeEl.querySelector('.dash-title');
      const subEl = welcomeEl.querySelector('.dash-sub');
      if (titleEl) titleEl.textContent = dash.welcome.title;
      if (subEl) subEl.textContent = dash.welcome.sub;
    }

    el.innerHTML = dash.content;
    renderQuicklinks(dash.quicklinks);
    if (role === 'super_admin') { loadAdminEnrollments(); loadAdminStats(); loadAdminTrainers(); }
    if (role === 'trainer') loadTrainerEnrollments();
    if (role === 'student') loadStudentEnrollments();
    if (role === 'recruiter') initRecruiterPayButton();
  }

  function initRecruiterPayButton() {
    var btn = document.getElementById('btnPayRecruiterAccess');
    if (!btn || typeof window.api === 'undefined') return;
    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.textContent = 'Processing…';
      window.api.post('/payment/recruiter-access').then(function (data) {
        if (data.already_active) {
          alert('Access granted!');
          window.location.reload();
          return;
        }
        if (data.demo && !data.key_id) {
          window.api.post('/payment/recruiter-access/verify', {
            razorpay_order_id: data.order_id,
            razorpay_payment_id: 'demo_' + Date.now(),
            razorpay_signature: 'demo',
          }).then(function () {
            alert('Access granted!');
            window.location.reload();
          }).catch(function (e) {
            btn.disabled = false;
            btn.textContent = 'Pay access fee';
            alert(e.error || 'Failed');
          });
          return;
        }
        var options = {
          key: data.key_id,
          amount: data.amount,
          currency: data.currency || 'INR',
          name: 'Vision Connects',
          description: 'Recruiter access',
          order_id: data.order_id,
          handler: function (r) {
            window.api.post('/payment/recruiter-access/verify', {
              razorpay_order_id: r.razorpay_order_id,
              razorpay_payment_id: r.razorpay_payment_id,
              razorpay_signature: r.razorpay_signature,
            }).then(function () {
              alert('Payment successful! Access granted.');
              window.location.reload();
            }).catch(function (e) {
              btn.disabled = false;
              btn.textContent = 'Pay access fee';
              alert(e.error || 'Verification failed');
            });
          },
        };
        if (typeof Razorpay !== 'undefined') {
          var rzp = new Razorpay(options);
          rzp.on('payment.failed', function () {
            btn.disabled = false;
            btn.textContent = 'Pay access fee';
            alert('Payment failed');
          });
          rzp.open();
        } else {
          btn.disabled = false;
          btn.textContent = 'Pay access fee';
          alert('Payment not available');
        }
      }).catch(function (e) {
        btn.disabled = false;
        btn.textContent = 'Pay access fee';
        alert(e.error || 'Failed');
      });
    });
  }

  function loadAdminStats() {
    if (typeof window.api === 'undefined') return;
    window.api.get('/admin/stats').then(function (data) {
      document.querySelectorAll('.dash-admin-stat').forEach(function (el, i) {
        var v = [data.users, data.courses, data.jobs, data.enrollments][i];
        if (v !== undefined) el.textContent = v;
      });
    }).catch(function () {});
  }

  function loadAdminTrainers() {
    var container = document.querySelector('#adminTrainersPanel .dash-admin-enrollments');
    if (!container) container = document.getElementById('adminTrainersPanel');
    if (!container) return;
    if (typeof window.api === 'undefined') return;
    window.api.get('/trainers?status=all').then(function (data) {
      var list = data.trainers || [];
      var pending = list.filter(function (t) { return (t.approval_status || 'pending') === 'pending'; });
      if (pending.length === 0) {
        container.innerHTML = '<p class="dash-panel-muted">No pending trainers.</p>';
        return;
      }
      container.innerHTML = '<table class="table table-sm"><thead><tr><th>Trainer</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
        pending.map(function (t) {
          return '<tr><td>' + escapeHtml(t.full_name) + '</td><td>' + escapeHtml(t.approval_status) + '</td><td>' +
            '<button type="button" class="btn btn-sm btn-success me-1" data-trainer-id="' + escapeHtml(t.id) + '" data-action="approved">Approve</button>' +
            '<button type="button" class="btn btn-sm btn-danger" data-trainer-id="' + escapeHtml(t.id) + '" data-action="rejected">Reject</button>' +
            '</td></tr>';
        }).join('') + '</tbody></table>';
      container.querySelectorAll('[data-action]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.dataset.trainerId;
          var status = btn.dataset.action === 'approved' ? 'approved' : 'rejected';
          window.api.patch('/admin/trainers/' + id + '/approve', { approval_status: status }).then(function () {
            loadAdminTrainers();
          }).catch(function () {});
        });
      });
    });
  }

  function loadStudentEnrollments() {
    const listEl = document.getElementById('dashMyCoursesList');
    if (!listEl) return;
    if (typeof window.api === 'undefined') {
      listEl.innerHTML = '<p class="dash-panel-muted">API not available.</p>';
      return;
    }
    window.api.get('/student/my-enrollments').then(function (data) {
      const rows = data.enrollments || [];
      if (rows.length === 0) {
        listEl.innerHTML = '<p class="dash-panel-muted">No courses yet. <a href="courses.html">Browse courses</a> and enroll with a trainer.</p>';
        return;
      }
      listEl.innerHTML = '<div class="row g-2">' + rows.slice(0, 6).map(function (e) {
        var slug = (e.course_slug || e.course_id || '').replace(/_/g, '-');
        var detailHref = slug ? ('course-detail.html?slug=' + encodeURIComponent(slug)) : 'courses.html?filter=my';
        var materialsHref = slug ? ('lms-materials.html?slug=' + encodeURIComponent(slug)) : null;
        return '<div class="col-12 col-sm-6"><a href="' + escapeHtml(detailHref) + '" class="dash-course-card"><span class="dash-course-card-title">' + escapeHtml(e.course_title || e.course_id) + '</span><span class="dash-course-card-trainer">' + escapeHtml(e.trainer_name || '') + '</span><span class="dash-course-card-status">' + escapeHtml(e.payment_status || '') + '</span></a>' + (materialsHref ? ' <a href="' + escapeHtml(materialsHref) + '" class="dash-course-materials-link small">Materials →</a>' : '') + '</div>';
      }).join('') + '</div>';
    }).catch(function () {
      listEl.innerHTML = '<p class="dash-panel-muted">Could not load courses.</p>';
    });
  }

  function loadAdminEnrollments() {
    const listEl = document.getElementById('adminEnrollmentsList');
    if (!listEl) return;
    if (typeof window.api === 'undefined') {
      listEl.innerHTML = '<p class="dash-panel-muted">API not available.</p>';
      return;
    }
    window.api.get('/trainer/enrollments').then(function (data) {
      const rows = data.enrollments || [];
      if (rows.length === 0) {
        listEl.innerHTML = '<p class="dash-panel-muted">No enrollments yet.</p>';
        return;
      }
      listEl.innerHTML = '<table class="table table-sm"><thead><tr><th>Student</th><th>Course</th><th>Contact</th><th>Payment</th></tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr><td>' + escapeHtml(r.student_name) + '</td><td>' + escapeHtml(r.course_id) + '</td><td>' + escapeHtml(r.contact_number) + '</td><td>' + escapeHtml(r.payment_status) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }).catch(function () {
      listEl.innerHTML = '<p class="dash-panel-muted">Failed to load enrollments.</p>';
    });
  }

  window.__refreshTrainerEnrollments = loadTrainerEnrollments;
  function loadTrainerEnrollments() {
    const listEl = document.getElementById('trainerEnrollmentsList');
    if (!listEl) return;
    if (typeof window.api === 'undefined') {
      listEl.innerHTML = '<p class="dash-panel-muted">API not available.</p>';
      return;
    }
    window.api.get('/trainer/enrollments').then(function (data) {
      const rows = data.enrollments || [];
      if (rows.length === 0) {
        listEl.innerHTML = '<p class="dash-panel-muted">No enrollments yet. Use "Enroll as Trainee" to add.</p>';
        return;
      }
      listEl.innerHTML = '<table class="table table-sm"><thead><tr><th>Student</th><th>Course</th><th>Contact</th><th>Payment</th></tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr><td>' + escapeHtml(r.student_name) + '</td><td>' + escapeHtml(r.course_id) + '</td><td>' + escapeHtml(r.contact_number) + '</td><td>' + escapeHtml(r.payment_status) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }).catch(function () {
      listEl.innerHTML = '<p class="dash-panel-muted">Failed to load enrollments.</p>';
    });
  }

  function load() {
    // Prefer real session (cookie) over stale lms_demo_user
    function tryApi() {
      if (typeof window.api === 'undefined') return Promise.resolve(false);
      return window.api.get('/auth/me').then(function (data) {
        const u = data.user;
        const p = data.profile || {};
        const user = {
          email: u.email,
          role: u.role,
          full_name: p.full_name,
          company_name: p.company_name,
          profile_image_url: p.profile_image_url,
          phone: p.phone,
          address: p.address,
          resume_url: p.resume_url,
          skills: p.skills,
          bio: p.bio,
        };
        try { localStorage.removeItem('lms_demo_user'); } catch (_) {}
        renderDashboard(user, u.role);
        return true;
      }).catch(function () { return false; });
    }

    function showExpired() {
      el.innerHTML = '<p class="dash-error">Session expired. <a href="login.html">Log in again</a> or <a href="register.html">Sign up</a>.</p>';
      if (quicklinksEl) quicklinksEl.innerHTML = '';
    }

    function fallbackDemo() {
      let demo = null;
      try { demo = JSON.parse(localStorage.getItem('lms_demo_user') || 'null'); } catch (_) {}
      if (demo && demo.email) {
        const role = demo.role || 'student';
        const user = { ...demo, full_name: demo.full_name, company_name: demo.company_name };
        renderDashboard(user, role);
        return;
      }
      showExpired();
    }

    try {
      tryApi().then(function (ok) {
        if (!ok) fallbackDemo();
      });
    } catch (err) {
      showExpired();
    }
  }

  if (el.textContent.trim() === 'Loading...') load();
})();
