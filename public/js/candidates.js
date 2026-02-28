/**
 * Candidates page interactions: search filters + result rendering.
 */
(function () {
  var searchSkillsEl = document.getElementById('searchSkills');
  var searchCourseEl = document.getElementById('searchCourse');
  var btnSearchEl = document.getElementById('btnSearch');
  var btnResetEl = document.getElementById('btnResetSearch');
  var resultsEl = document.getElementById('candidatesResults');
  var countEl = document.getElementById('candidatesCount');
  var btnLogoutEl = document.getElementById('btnLogout');

  if (!resultsEl) return;

  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function updateCount(count) {
    if (!countEl) return;
    countEl.textContent = count === 1 ? '1 candidate' : count + ' candidates';
  }

  function renderCandidates(candidates) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      resultsEl.innerHTML =
        '<div class="candidates-empty-state">' +
          '<p class="text-muted mb-1">No candidates found for this search.</p>' +
          '<p class="small text-muted mb-0">Try broader skills or a different course keyword.</p>' +
        '</div>';
      updateCount(0);
      return;
    }

    resultsEl.innerHTML = candidates.map(function (candidate) {
      var skills = (candidate.skills || []).map(function (skill) {
        return '<span class="candidate-skill">' + escapeHtml(skill) + '</span>';
      }).join('');
      return (
        '<article class="candidate-card">' +
          '<div class="candidate-card-head">' +
            '<h3 class="candidate-name">' + escapeHtml(candidate.full_name || '') + '</h3>' +
            '<span class="candidate-grade">Grade ' + escapeHtml(candidate.grade || '-') + '</span>' +
          '</div>' +
          '<p class="candidate-course">' + escapeHtml(candidate.course || '-') + '</p>' +
          '<div class="candidate-skills">' + skills + '</div>' +
          '<p class="candidate-meta">Location: ' + escapeHtml(candidate.city || '-') + '</p>' +
        '</article>'
      );
    }).join('');
    updateCount(candidates.length);
  }

  function localFilter(candidates, skillsQuery, courseQuery) {
    var sq = (skillsQuery || '').trim().toLowerCase();
    var cq = (courseQuery || '').trim().toLowerCase();
    return candidates.filter(function (candidate) {
      var candidateSkills = (candidate.skills || []).join(' ').toLowerCase();
      var candidateCourse = (candidate.course || '').toLowerCase();
      var candidateName = (candidate.full_name || '').toLowerCase();
      var matchSkills = !sq || candidateSkills.indexOf(sq) !== -1 || candidateName.indexOf(sq) !== -1;
      var matchCourse = !cq || candidateCourse.indexOf(cq) !== -1;
      return matchSkills && matchCourse;
    });
  }

  function normaliseApiResult(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.students)) return data.students;
    if (data && Array.isArray(data.candidates)) return data.candidates;
    return [];
  }

  function searchCandidates() {
    if (window.api && window.api.isLoggedIn && !window.api.isLoggedIn()) {
      window.location.href = 'login.html?redirect=candidates.html';
      return;
    }
    var skills = searchSkillsEl ? searchSkillsEl.value.trim() : '';
    var course = searchCourseEl ? searchCourseEl.value.trim() : '';

    resultsEl.innerHTML =
      '<div class="candidates-empty-state">' +
        '<p class="text-muted mb-0">Searching candidates...</p>' +
      '</div>';

    if (!window.api) {
      resultsEl.innerHTML = '<div class="alert alert-danger">API client not available.</div>';
      updateCount(0);
      return;
    }

    window.api.get('/students/search?skills=' + encodeURIComponent(skills) + '&course=' + encodeURIComponent(course))
      .then(function (data) {
        var apiList = normaliseApiResult(data);
        if (apiList.length) {
          renderCandidates(apiList.map(function (candidate) {
            return {
              full_name: candidate.full_name || candidate.name || 'Candidate',
              course: candidate.course || candidate.completed_course || candidate.course_name || '',
              grade: candidate.grade || candidate.performance_grade || '-',
              city: candidate.city || candidate.location || '',
              skills: Array.isArray(candidate.skills) ? candidate.skills : [],
            };
          }));
          return;
        }
        renderCandidates([]);
      })
      .catch(function (err) {
        if (err && err.status === 403) {
          resultsEl.innerHTML = '<div class="alert alert-warning">Recruiter paid access required. Contact admin to enable candidate search.</div>';
          updateCount(0);
          return;
        }
        resultsEl.innerHTML = '<div class="alert alert-danger">Failed to load candidates.</div>';
        updateCount(0);
      });
  }

  if (btnSearchEl) btnSearchEl.addEventListener('click', searchCandidates);
  if (btnResetEl) {
    btnResetEl.addEventListener('click', function () {
      if (searchSkillsEl) searchSkillsEl.value = '';
      if (searchCourseEl) searchCourseEl.value = '';
      renderCandidates([]);
    });
  }

  if (btnLogoutEl) {
    btnLogoutEl.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.api && window.api.post) {
        window.api.post('/auth/logout').finally(function () {
          window.location.href = 'index.html';
        });
      } else {
        window.location.href = 'index.html';
      }
    });
  }

  renderCandidates([]);
})();
