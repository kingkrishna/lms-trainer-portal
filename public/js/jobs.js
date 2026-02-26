/**
 * Jobs page: load jobs and render listing cards.
 * Jobs shown immediately from demo data; API can replace when available.
 */

(function () {
  var jobListEl = document.getElementById('jobList');
  var jobCountEl = document.getElementById('jobCount');
  var jobSearchEl = document.getElementById('jobSearch');
  var jobsEmptyEl = document.getElementById('jobsEmpty');
  var studentsWaitingListEl = document.getElementById('studentsWaitingList');
  var studentsWaitingCountEl = document.getElementById('studentsWaitingCount');
  var studentsWaitingEmptyEl = document.getElementById('studentsWaitingEmpty');
  var studentTechFilterEl = document.getElementById('studentTechFilter');
  var studentPriorityFilterEl = document.getElementById('studentPriorityFilter');
  var applyStudentFilterEl = document.getElementById('applyStudentFilter');
  var tabJobsEl = document.getElementById('tabJobs');
  var tabStudentsEl = document.getElementById('tabStudents');
  var jobsPanelEl = document.getElementById('jobsPanel');
  var studentsPanelEl = document.getElementById('studentsPanel');

  if (!jobListEl) return;

  var DEMO_JOBS = [
    {
      id: 'job-1',
      title: 'Junior Accountant',
      company: 'ABC & Co. Chartered Accountants',
      location: 'Mumbai, Maharashtra',
      job_type: 'full_time',
      description: 'Handle day-to-day bookkeeping, bank reconciliation, and assist in financial statements. Tally experience preferred.',
    },
    {
      id: 'job-2',
      title: 'Tax Associate',
      company: 'XYZ Tax Consultants',
      location: 'Bangalore, Karnataka',
      job_type: 'full_time',
      description: 'Income tax and GST compliance, return filing, and client support. Fresh CAs and commerce graduates welcome.',
      badge: 'Popular',
    },
    {
      id: 'job-3',
      title: 'Audit Trainee',
      company: 'Grant & Partners',
      location: 'Delhi NCR',
      job_type: 'full_time',
      description: 'Support statutory and internal audit engagements. CA Inter / Final students can apply.',
      badge: 'New',
    },
    {
      id: 'job-4',
      title: 'Tally Operator',
      company: 'Retail Solutions Pvt Ltd',
      location: 'Chennai, Tamil Nadu',
      job_type: 'full_time',
      description: 'Maintain accounts in Tally, GST returns, and vendor reconciliation. 1–2 years experience.',
    },
    {
      id: 'job-5',
      title: 'Finance Intern',
      company: 'ScaleUp Ventures',
      location: 'Remote',
      job_type: 'internship',
      description: 'Assist in financial reporting, variance analysis, and dashboards. MBA/CA students preferred.',
      badge: 'Remote',
    },
    {
      id: 'job-6',
      title: 'Accounts Executive',
      company: 'Metro Manufacturing Ltd',
      location: 'Pune, Maharashtra',
      job_type: 'full_time',
      description: 'Cost accounting, inventory, and month-end closing. CMA or B.Com with 2+ years experience.',
    },
    {
      id: 'job-7',
      title: 'Part-time Bookkeeper',
      company: 'Small Business Services',
      location: 'Hyderabad, Telangana',
      job_type: 'part_time',
      description: 'Bookkeeping and payroll for multiple clients. Flexible hours. Tally knowledge required.',
    },
  ];

  var DEMO_WAITING_STUDENTS = [
    { id: 'st-1', full_name: 'Ananya Gupta', technology: 'Tally ERP', grade: 'A+', priority: 'high' },
    { id: 'st-2', full_name: 'Rohit Nair', technology: 'GST Filing', grade: 'A', priority: 'high' },
    { id: 'st-3', full_name: 'Divya Sharma', technology: 'Excel & MIS', grade: 'A', priority: 'medium' },
    { id: 'st-4', full_name: 'Karthik Rao', technology: 'SAP FICO', grade: 'B+', priority: 'high' },
    { id: 'st-5', full_name: 'Meera Joshi', technology: 'Financial Reporting', grade: 'A+', priority: 'medium' },
    { id: 'st-6', full_name: 'Sandeep Kumar', technology: 'Income Tax', grade: 'B', priority: 'low' },
    { id: 'st-7', full_name: 'Pooja Iyer', technology: 'QuickBooks', grade: 'A', priority: 'medium' },
  ];

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

  function getPriorityLabel(priority) {
    var map = { high: 'High', medium: 'Medium', low: 'Low' };
    return map[priority] || 'Medium';
  }

  function getPriorityRank(priority) {
    var map = { high: 3, medium: 2, low: 1 };
    return map[priority] || 0;
  }

  function getGradeRank(grade) {
    var map = { 'A+': 5, A: 4, 'B+': 3, B: 2, C: 1 };
    return map[grade] || 0;
  }

  function renderCard(job) {
    var typeLabel = getJobTypeLabel(job.job_type);
    var badge = job.badge
      ? '<span class="job-card-badge">' + escapeHtml(job.badge) + '</span>'
      : '';
    var id = (job.id || '').toString();
    return (
      '<article class="job-card" data-id="' + escapeHtml(id) + '">' +
        '<a href="job-detail.html?id=' + encodeURIComponent(id) + '" class="job-card-link">' +
          '<div class="job-card-header">' +
            '<span class="job-card-type">' + escapeHtml(typeLabel) + '</span>' +
            badge +
          '</div>' +
          '<h3 class="job-card-title">' + escapeHtml(job.title) + '</h3>' +
          '<p class="job-card-company">' + escapeHtml(job.company || '') + '</p>' +
          '<p class="job-card-location">' + escapeHtml(job.location || '') + '</p>' +
          '<p class="job-card-desc">' + escapeHtml(job.description || '') + '</p>' +
          '<span class="job-card-cta">View & apply →</span>' +
        '</a>' +
      '</article>'
    );
  }

  function renderList(jobs) {
    if (!jobs || jobs.length === 0) {
      jobListEl.innerHTML = '';
      if (jobCountEl) jobCountEl.textContent = 'No jobs';
      if (jobsEmptyEl) jobsEmptyEl.classList.remove('d-none');
      return;
    }
    if (jobsEmptyEl) jobsEmptyEl.classList.add('d-none');
    jobListEl.innerHTML = jobs.map(renderCard).join('');
    if (jobCountEl) {
      jobCountEl.textContent = jobs.length === 1 ? '1 job' : jobs.length + ' jobs';
    }
  }

  function filterJobs(jobs, query) {
    if (!query || !query.trim()) return jobs;
    var q = query.trim().toLowerCase();
    return jobs.filter(function (j) {
      var title = (j.title || '').toLowerCase();
      var company = (j.company || '').toLowerCase();
      var desc = (j.description || '').toLowerCase();
      var location = (j.location || '').toLowerCase();
      var type = getJobTypeLabel(j.job_type).toLowerCase();
      return title.indexOf(q) !== -1 || company.indexOf(q) !== -1 ||
             desc.indexOf(q) !== -1 || location.indexOf(q) !== -1 || type.indexOf(q) !== -1;
    });
  }

  function renderWaitingStudents(list) {
    if (!studentsWaitingListEl) return;
    if (!Array.isArray(list) || list.length === 0) {
      studentsWaitingListEl.innerHTML = '';
      if (studentsWaitingCountEl) studentsWaitingCountEl.textContent = '0 students';
      if (studentsWaitingEmptyEl) studentsWaitingEmptyEl.classList.remove('d-none');
      return;
    }

    if (studentsWaitingEmptyEl) studentsWaitingEmptyEl.classList.add('d-none');
    if (studentsWaitingCountEl) {
      studentsWaitingCountEl.textContent = list.length === 1 ? '1 student' : list.length + ' students';
    }

    studentsWaitingListEl.innerHTML = list.map(function (student) {
      return (
        '<article class="student-wait-card" data-id="' + escapeHtml(student.id || '') + '">' +
          '<div class="student-wait-card-head">' +
            '<h3 class="student-wait-name">' + escapeHtml(student.full_name || '') + '</h3>' +
            '<span class="student-priority ' + escapeHtml(student.priority || 'medium') + '">' + escapeHtml(getPriorityLabel(student.priority)) + '</span>' +
          '</div>' +
          '<p class="student-wait-meta"><strong>Technology:</strong> ' + escapeHtml(student.technology || '-') + '</p>' +
          '<p class="student-wait-meta"><strong>Grade:</strong> ' + escapeHtml(student.grade || '-') + '</p>' +
        '</article>'
      );
    }).join('');
  }

  function filterAndRankStudents(students) {
    var selectedTech = studentTechFilterEl ? (studentTechFilterEl.value || 'all') : 'all';
    var selectedPriority = studentPriorityFilterEl ? (studentPriorityFilterEl.value || 'all') : 'all';

    var filtered = students.filter(function (student) {
      var techMatch = selectedTech === 'all' || student.technology === selectedTech;
      var priorityMatch = selectedPriority === 'all' || student.priority === selectedPriority;
      return techMatch && priorityMatch;
    });

    return filtered.sort(function (a, b) {
      var priorityDiff = getPriorityRank(b.priority) - getPriorityRank(a.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return getGradeRank(b.grade) - getGradeRank(a.grade);
    });
  }

  function populateTechnologyFilter(students) {
    if (!studentTechFilterEl) return;
    var existing = {};
    students.forEach(function (student) {
      if (student.technology) existing[student.technology] = true;
    });
    Object.keys(existing).sort().forEach(function (technology) {
      var option = document.createElement('option');
      option.value = technology;
      option.textContent = technology;
      studentTechFilterEl.appendChild(option);
    });
  }

  function setActiveView(view) {
    var isJobs = view === 'jobs';
    if (jobsPanelEl) jobsPanelEl.classList.toggle('d-none', !isJobs);
    if (studentsPanelEl) studentsPanelEl.classList.toggle('d-none', isJobs);
    if (tabJobsEl) {
      tabJobsEl.classList.toggle('active', isJobs);
      tabJobsEl.setAttribute('aria-selected', isJobs ? 'true' : 'false');
    }
    if (tabStudentsEl) {
      tabStudentsEl.classList.toggle('active', !isJobs);
      tabStudentsEl.setAttribute('aria-selected', !isJobs ? 'true' : 'false');
    }
  }

  var allJobs = DEMO_JOBS.slice();
  var allWaitingStudents = DEMO_WAITING_STUDENTS.slice();

  function loadJobs() {
    if (jobsEmptyEl) jobsEmptyEl.classList.add('d-none');
    renderList(filterJobs(allJobs, jobSearchEl ? jobSearchEl.value : ''));

    if (typeof window.api === 'undefined') return;

    window.api.get('/jobs')
      .then(function (data) {
        var list = data;
        if (data && Array.isArray(data.jobs)) list = data.jobs;
        if (Array.isArray(list) && list.length > 0) allJobs = list;
        renderList(filterJobs(allJobs, jobSearchEl ? jobSearchEl.value : ''));
      })
      .catch(function () {
        allJobs = DEMO_JOBS.slice();
        renderList(filterJobs(allJobs, jobSearchEl ? jobSearchEl.value : ''));
      });
  }

  if (jobSearchEl) {
    jobSearchEl.addEventListener('input', function () {
      renderList(filterJobs(allJobs, jobSearchEl.value));
    });
  }

  if (applyStudentFilterEl) {
    applyStudentFilterEl.addEventListener('click', function () {
      renderWaitingStudents(filterAndRankStudents(allWaitingStudents));
    });
  }

  if (tabJobsEl) {
    tabJobsEl.addEventListener('click', function () {
      setActiveView('jobs');
    });
  }

  if (tabStudentsEl) {
    tabStudentsEl.addEventListener('click', function () {
      setActiveView('students');
    });
  }

  populateTechnologyFilter(allWaitingStudents);
  renderWaitingStudents(filterAndRankStudents(allWaitingStudents));
  setActiveView('jobs');

  loadJobs();
})();
