/**
 * Course detail page: show one course by slug (from query).
 * Price only from API/data—never calculated.
 */

(function () {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  const contentEl = document.getElementById('courseDetailContent');
  const breadcrumbTitleEl = document.getElementById('breadcrumbTitle');

  const COURSE_CACHE = {};

  function formatPrice(amount, currency) {
    if (currency === 'INR') return '₹' + Number(amount).toLocaleString('en-IN');
    return currency + ' ' + Number(amount).toLocaleString();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function render(course) {
    if (!course) {
      contentEl.innerHTML = '<div class="course-detail-loading">Course not found. <a href="courses.html">Back to courses</a>.</div>';
      if (breadcrumbTitleEl) breadcrumbTitleEl.textContent = 'Not found';
      return;
    }
    const priceText = course.price != null ? formatPrice(course.price, course.currency || 'INR') : 'Price on request';
    const icon = '📒';
    if (breadcrumbTitleEl) breadcrumbTitleEl.textContent = course.title;
    contentEl.innerHTML =
      '<div class="course-detail-card">' +
        '<div class="course-detail-hero"><span class="course-detail-hero-icon">' + icon + '</span></div>' +
        '<div class="course-detail-body">' +
          '<h1 class="course-detail-title">' + escapeHtml(course.title) + '</h1>' +
          '<p class="course-detail-price price-display">' + escapeHtml(priceText) + '</p>' +
          (course.duration ? '<p class="course-detail-desc"><strong>Duration:</strong> ' + escapeHtml(course.duration) + '</p>' : '') +
          (course.certification ? '<p class="course-detail-desc"><strong>Certification:</strong> ' + escapeHtml(course.certification) + '</p>' : '') +
          '<p class="course-detail-desc">' + escapeHtml(course.description || '') + '</p>' +
          '<div class="course-detail-actions">' +
            '<a href="trainers.html?course=' + encodeURIComponent(course.slug || course.id) + '" class="btn btn-choose-trainer">Choose a trainer</a>' +
            (course.slug ? '<a href="lms-materials.html?slug=' + encodeURIComponent(course.slug) + '" class="btn btn-outline-primary ms-2">View materials</a>' : '') +
            '<a href="courses.html" class="btn btn-back-courses">← All courses</a>' +
          '</div>' +
          '<p class="course-detail-note">Price is set by the platform. You’ll pay only after choosing a trainer; access is granted after verified payment.</p>' +
        '</div>' +
      '</div>';
  }

  if (!slug) {
    render(null);
    return;
  }

  if (typeof window.api !== 'undefined') {
    window.api.get('/courses/' + encodeURIComponent(slug))
      .then(function (data) {
        render(data && data.slug ? data : (COURSE_CACHE[slug] || null));
      })
      .catch(function () {
        render(COURSE_CACHE[slug] || null);
      });
  } else {
    render(COURSE_CACHE[slug] || null);
  }
})();
