/**
 * Courses page (API-backed only).
 */

(function () {
  const courseListEl = document.getElementById('courseList');
  const courseCountEl = document.getElementById('courseCount');
  const courseSearchEl = document.getElementById('courseSearch');
  const coursesEmptyEl = document.getElementById('coursesEmpty');
  const coursesSectionEmptyEl = document.getElementById('coursesSectionEmpty');
  const sectionTitleEl = document.getElementById('coursesSectionTitle');
  const sectionDescEl = document.getElementById('coursesSectionDesc');
  const coursesToolbar = document.querySelector('.courses-toolbar');
  const coursesTabs = document.querySelector('.courses-tabs');
  const coursesPackageTabs = document.querySelector('.courses-package-tabs');
  if (!courseListEl) return;

  const urlParams = new URLSearchParams(location.search);
  const isMyCourses = urlParams.get('filter') === 'my';
  let COURSE_CATALOG = [];

  function formatPrice(amount) {
    return '₹' + Number(amount).toLocaleString('en-IN');
  }

  function renderFlyer(course) {
    const priceText = course.price != null ? formatPrice(course.price) : 'Price on request';
    const certs = (course.certifications || []).map(function (cert) { return '<li>' + escapeHtml(cert) + '</li>'; }).join('');
    const badge = '<span class="course-flyer-badge">' + escapeHtml(getPackageLabel(course.package_type)) + '</span>';
    const slug = course.slug || course.id;
    return (
      '<article class="course-flyer" data-id="' + escapeHtml(String(course.id)) + '">' +
        '<a href="course-detail.html?slug=' + encodeURIComponent(slug) + '" class="course-flyer-link">' +
          '<div class="course-flyer-image">' +
            '<span class="course-flyer-icon">' + getCourseIcon(course) + '</span>' +
            badge +
          '</div>' +
          '<div class="course-flyer-body">' +
            '<h3 class="course-flyer-title">' + escapeHtml(course.title) + '</h3>' +
            '<p class="course-flyer-desc">' + escapeHtml(course.description || '') + '</p>' +
            '<div class="course-flyer-meta">' +
              '<span><strong>Duration:</strong> ' + escapeHtml(course.duration || '-') + '</span>' +
              '<span><strong>Certification:</strong></span>' +
              '<ul class="course-flyer-certs">' + (certs || '<li>-</li>') + '</ul>' +
            '</div>' +
            '<div class="course-flyer-footer">' +
              '<span class="course-flyer-price price-display">' + escapeHtml(priceText) + '</span>' +
              '<span class="course-flyer-cta">View course →</span>' +
            '</div>' +
          '</div>' +
        '</a>' +
      '</article>'
    );
  }

  function getCourseIcon(course) {
    const icons = ['📒', '📊', '💰', '🧾', '🧮', '📈', '🏛️', '📑', '💼'];
    const i = Math.abs(hashCode(course.id)) % icons.length;
    return icons[i];
  }

  function hashCode(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
    return h;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getPackageLabel(type) {
    if (type === 'combo') return 'Combo';
    if (type === 'package') return 'Package';
    return 'Individual';
  }

  function renderList(courses) {
    const filtered = courses || [];
    if (coursesEmptyEl) coursesEmptyEl.classList.add('d-none');

    if (filtered.length === 0) {
      courseListEl.innerHTML = '';
      if (courseCountEl) courseCountEl.textContent = 'No courses';
      if (coursesEmptyEl) coursesEmptyEl.classList.remove('d-none');
      if (coursesSectionEmptyEl) coursesSectionEmptyEl.classList.remove('d-none');
      return;
    }

    if (coursesSectionEmptyEl) coursesSectionEmptyEl.classList.add('d-none');
    courseListEl.innerHTML = filtered.map(renderFlyer).join('');
    if (courseCountEl) courseCountEl.textContent = filtered.length === 1 ? '1 course' : filtered.length + ' courses';
  }

  function filterCourses(courses, query, school, packageType) {
    if (!query || !query.trim()) return courses;
    const q = query.trim().toLowerCase();
    const byText = courses.filter(function (c) {
      const certText = (c.certifications || []).join(' ').toLowerCase();
      return (c.title && c.title.toLowerCase().includes(q)) ||
             (c.description && c.description.toLowerCase().includes(q)) ||
             certText.includes(q);
    });
    return byText.filter(function (c) {
      const schoolMatch = (c.school === school || c.school === 'all');
      const packageMatch = c.package_type === packageType;
      return schoolMatch && packageMatch;
    });
  }

  function applyFilters() {
    if (sectionTitleEl) {
      sectionTitleEl.textContent = activeSchool === 'tax' ? 'Tax School' : (activeSchool === 'technical' ? 'Technical Courses' : 'Accounting School');
    }
    if (sectionDescEl) {
      sectionDescEl.textContent = activePackage === 'individual'
        ? 'Choose your individual course.'
        : (activePackage === 'combo'
          ? 'Choose your combo course plan.'
          : 'Choose the full package plan.');
    }

    const q = courseSearchEl ? courseSearchEl.value : '';
    const base = COURSE_CATALOG.filter(function (c) { return (c.school === activeSchool || c.school === 'all') && c.package_type === activePackage; });
    renderList(filterCourses(base, q, activeSchool, activePackage));
  }

  if (courseSearchEl) {
    courseSearchEl.addEventListener('input', function () {
      applyFilters();
    });
  }

  let activeSchool = 'accounting';
  let activePackage = 'individual';

  const urlSchool = (function () {
    const p = new URLSearchParams(location.search);
    const c = p.get('school');
    return (c === 'tax' || c === 'accounting' || c === 'technical') ? c : 'accounting';
  })();

  function setActiveSchool(school) {
    activeSchool = school;
    const tabs = document.querySelectorAll('.courses-tab');
    tabs.forEach(function (t) {
      const isActive = t.getAttribute('data-school') === school;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    applyFilters();
  }

  document.querySelectorAll('.courses-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setActiveSchool(btn.getAttribute('data-school'));
    });
  });

  function setActivePackage(type) {
    activePackage = type;
    document.querySelectorAll('.courses-package-tab').forEach(function (tab) {
      const isActive = tab.getAttribute('data-package') === type;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    applyFilters();
  }

  document.querySelectorAll('.courses-package-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setActivePackage(btn.getAttribute('data-package'));
    });
  });

  function loadMyCourses() {
    if (typeof window.api === 'undefined' || !window.api.isLoggedIn || !window.api.isLoggedIn()) {
      window.location.href = 'login.html?redirect=' + encodeURIComponent('courses.html?filter=my');
      return;
    }
    if (coursesToolbar) coursesToolbar.classList.add('d-none');
    if (coursesTabs) coursesTabs.classList.add('d-none');
    if (coursesPackageTabs) coursesPackageTabs.classList.add('d-none');
    if (sectionTitleEl) sectionTitleEl.textContent = 'My courses';
    if (sectionDescEl) {
      sectionDescEl.innerHTML = 'Courses you have enrolled in. <a href="courses.html">Browse all courses</a>';
    }

    window.api.get('/enrollments/my').then(function (data) {
      const enrollments = data.enrollments || [];
      const seen = {};
      const myCourses = [];
      enrollments.forEach(function (e) {
        const slug = (e.course_slug || e.course_id || '').toLowerCase().replace(/_/g, '-');
        if (seen[slug]) return;
        seen[slug] = true;
        const found = COURSE_CATALOG.find(function (c) {
          const cid = (c.id || c.slug || '').toLowerCase().replace(/_/g, '-');
          return cid === slug;
        });
        if (found) {
          myCourses.push(found);
        } else {
          myCourses.push({
            id: e.course_id,
            slug: e.course_slug || e.course_id,
            title: e.course_title || e.course_id,
            school: 'accounting',
            package_type: 'individual',
            duration: '-',
            price: null,
            certifications: [],
            description: 'Enrolled with ' + (e.trainer_name || 'trainer') + '. Payment: ' + (e.payment_status || 'pending') + '.',
          });
        }
      });
      renderList(myCourses);
    }).catch(function () {
      if (coursesSectionEmptyEl) coursesSectionEmptyEl.textContent = 'Could not load your courses. Please try again.';
      if (coursesSectionEmptyEl) coursesSectionEmptyEl.classList.remove('d-none');
      courseListEl.innerHTML = '';
    });
  }

  function inferSchool(slug) {
    const s = String(slug || '').toLowerCase();
    if (s.includes('tax') || s.includes('gst') || s.includes('tds')) return 'tax';
    if (s.includes('java') || s.includes('technical')) return 'technical';
    return 'accounting';
  }

  function inferPackageType(title, slug) {
    const t = (String(title || '') + ' ' + String(slug || '')).toLowerCase();
    if (t.includes('combo')) return 'combo';
    if (t.includes('package')) return 'package';
    return 'individual';
  }

  function loadCatalog() {
    if (typeof window.api === 'undefined') {
      COURSE_CATALOG = [];
      return Promise.resolve();
    }
    return window.api.get('/courses').then(function (data) {
      const courses = data.courses || [];
      COURSE_CATALOG = courses.map(function (c) {
        const slug = c.slug || c.id;
        return {
          id: c.id,
          title: c.title || 'Untitled course',
          slug: slug,
          school: inferSchool(slug),
          package_type: inferPackageType(c.title, slug),
          duration: c.duration || '-',
          price: c.price,
          certifications: [],
          description: c.description || '',
        };
      });
    }).catch(function () {
      COURSE_CATALOG = [];
    });
  }

  loadCatalog().then(function () {
    if (isMyCourses) {
      loadMyCourses();
    } else {
      setActiveSchool(urlSchool);
      setActivePackage('individual');
      applyFilters();
    }
  });
})();
