/**
 * Jobs page: load jobs and render listing cards.
 * Jobs are loaded from the backend API.
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

  var JOBS_CACHE = [];
  var WAITING_STUDENTS_CACHE = [];

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

  var allJobs = JOBS_CACHE.slice();
  var allWaitingStudents = WAITING_STUDENTS_CACHE.slice();

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
        allJobs = [];
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
