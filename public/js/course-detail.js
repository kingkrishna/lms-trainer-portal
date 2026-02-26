/**
 * Course detail page: show one course by slug (from query).
 * Price only from API/data—never calculated.
 */

(function () {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  const contentEl = document.getElementById('courseDetailContent');
  const breadcrumbTitleEl = document.getElementById('breadcrumbTitle');

  const DEMO_COURSES = {
    'core-accounting': {
      id: 'acc-1',
      title: 'Core Accounting',
      slug: 'core-accounting',
      description: 'Core accounting concepts and practical workflow from basics to financial reporting.',
      price: 3600,
      duration: '15 Working Days',
      certification: 'Certificate from Vision Connects',
      currency: 'INR',
    },
    'income-tax-tds': {
      id: 'tax-1',
      title: 'Income Tax and TDS',
      slug: 'income-tax-tds',
      description: 'Income tax filing and TDS compliance with practical examples and return workflow.',
      price: 3600,
      duration: '20 Working Days',
      certification: 'Certificate from Vision Connects',
      currency: 'INR',
    },
    'gst-theory-simulation': {
      id: 'tax-2',
      title: 'GST Theory and Simulation',
      slug: 'gst-theory-simulation',
      description: 'GST theory plus simulation-based practical sessions for real compliance scenarios.',
      price: 5000,
      duration: '15 Working Days',
      certification: 'Certificate from Vision Connects',
      currency: 'INR',
    },
    'gst-simulation': {
      id: 'tax-3',
      title: 'GST Simulation',
      slug: 'gst-simulation',
      description: 'Hands-on GST simulation practice aligned with Tally-based workflow.',
      price: 3600,
      duration: '15 Working Days',
      certification: 'Tally Certification for GST Simulation',
      currency: 'INR',
    },
    'zoho-books': {
      id: 'acc-2',
      title: 'Zoho Books',
      slug: 'zoho-books',
      description: 'Zoho Books setup and operations for business accounting and reporting.',
      price: 5000,
      duration: '15 Working Days',
      certification: 'Basic Certification from Vision Connects, Zoho Certification - 2,500',
      currency: 'INR',
    },
    'tally': {
      id: 'acc-3',
      title: 'Tally',
      slug: 'tally',
      description: 'Comprehensive Tally training for accounting entries, GST, and reports.',
      price: 5000,
      duration: '30 Working Days',
      certification: 'Tally Certification',
      currency: 'INR',
    },
    'combo-accounting-tally-zoho': {
      id: 'combo-1',
      title: 'Core Accounting, Tally and Zoho',
      slug: 'combo-accounting-tally-zoho',
      description: 'Combo track for accounting foundation plus Tally and Zoho practical execution.',
      price: 10000,
      duration: '30-45 Working Days',
      certification: 'Certificate from Vision Connects, Tally Certification, Zoho Certification (extra 2,500 for Zoho Certification)',
      currency: 'INR',
    },
    'combo-tax-school': {
      id: 'combo-2',
      title: 'Tax (GST, Income Tax and TDS) including Simulation',
      slug: 'combo-tax-school',
      description: 'Complete tax combo covering GST, Income Tax, TDS, and simulation modules.',
      price: 12000,
      duration: '30-45 Working Days',
      certification: 'Certificate from Vision Connects',
      currency: 'INR',
    },
    'total-course-package': {
      id: 'pkg-1',
      title: 'Total Course Package',
      slug: 'total-course-package',
      description: 'Full package combining accounting, tax, and tools into one complete program.',
      price: 25000,
      duration: '3-4 Months',
      certification: 'Certificate from Vision Connects, Tally Certification, Zoho Certification, Zoho Business Communication Certification',
      currency: 'INR',
    },
    'technical-writing': {
      id: 'tech-1',
      title: 'Technical Writing',
      slug: 'technical-writing',
      description: 'Professional technical writing for documentation, reports, and communication.',
      price: 12000,
      duration: '20 Working Days',
      certification: 'Certificate from Vision Connects',
      currency: 'INR',
    },
    'java-course': {
      id: 'tech-2',
      title: 'Java Course',
      slug: 'java-course',
      description: 'Java programming from fundamentals to advanced coding with practical exercises.',
      price: 10000,
      duration: '30 Working Days',
      certification: 'Certificate from Vision Connects',
      currency: 'INR',
    },
  };

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
        render(data && data.slug ? data : (DEMO_COURSES[slug] || null));
      })
      .catch(function () {
        render(DEMO_COURSES[slug] || null);
      });
  } else {
    render(DEMO_COURSES[slug] || null);
  }
})();
