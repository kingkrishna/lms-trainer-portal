/**
 * Candidate enrollment process: two steps (one-on-one + group class),
 * schedule selection, and payment options (pay after counselling | direct pay).
 */

(function () {
  const params = new URLSearchParams(window.location.search);
  const courseSlug = params.get('course');
  const trainerId = params.get('trainer');
  const contentEl = document.getElementById('candidateProcessContent');
  const breadcrumbEl = document.getElementById('breadcrumbStep');

  const DEMO_COURSES = {
    'core-accounting': { id: 'acc-0', title: 'Core Accounting', price: 3600, currency: 'INR' },
    'financial-accounting-fundamentals': { id: 'acc-1', title: 'Financial Accounting Fundamentals', price: 4999, currency: 'INR' },
    'cost-management-accounting': { id: 'acc-2', title: 'Cost & Management Accounting', price: 5499, currency: 'INR' },
    'taxation-income-tax-gst': { id: 'acc-3', title: 'Taxation – Income Tax & GST', price: 5999, currency: 'INR' },
    'income-tax-tds': { id: 'acc-3b', title: 'Income Tax and TDS', price: 3600, currency: 'INR' },
    'gst-simulation': { id: 'acc-3c', title: 'GST Simulation', price: 3600, currency: 'INR' },
    'auditing-assurance': { id: 'acc-4', title: 'Auditing & Assurance', price: 6499, currency: 'INR' },
    'zoho-books': { id: 'acc-4b', title: 'Zoho Books', price: 5000, currency: 'INR' },
    'ai-in-accounting': { id: 'acc-4c', title: 'AI in Accounting', price: 5000, currency: 'INR' },
    'tally': { id: 'acc-4d', title: 'Tally', price: 5000, currency: 'INR' },
    'tally-accounting-software': { id: 'acc-5', title: 'Tally & Accounting Software', price: 3499, currency: 'INR' },
    'financial-reporting-ind-as-ifrs': { id: 'acc-6', title: 'Financial Reporting (Ind AS / IFRS)', price: 6999, currency: 'INR' },
    'ca-foundation-preparation': { id: 'acc-7', title: 'CA Foundation Preparation', price: 8999, currency: 'INR' },
    'bookkeeping-payroll': { id: 'acc-8', title: 'Bookkeeping & Payroll', price: 2999, currency: 'INR' },
    'corporate-finance-valuation': { id: 'acc-9', title: 'Corporate Finance & Valuation', price: 6499, currency: 'INR' },
    'interview-prep-soft-skills': { id: 'acc-10', title: 'Interview Prep & Soft Skills', price: 2499, currency: 'INR' },
  };

  const DEMO_TRAINERS = {
    'tr-1': { id: 'tr-1', full_name: 'Nitin Kumar D', hasGroupClass: true, courses: ['zoho-books', 'ai-in-accounting'] },
    'tr-2': { id: 'tr-2', full_name: 'Ashok Raju', hasGroupClass: false, courses: ['taxation-income-tax-gst', 'income-tax-tds'] },
    'tr-3': { id: 'tr-3', full_name: 'Prasanth', hasGroupClass: true, courses: ['gst-simulation', 'income-tax-tds'] },
    'tr-4': { id: 'tr-4', full_name: 'Venkatesh', hasGroupClass: false, courses: ['core-accounting'] },
    'tr-5': { id: 'tr-5', full_name: 'Srinivas', hasGroupClass: true, courses: ['tally', 'gst-simulation'] },
    'tr-6': { id: 'tr-6', full_name: 'JayaShree', hasGroupClass: true, courses: ['gst-simulation'] },
  };

  const SCHEDULE_SLOTS = [
    'Mon 10:00 AM – 11:00 AM',
    'Tue 2:00 PM – 3:00 PM',
    'Wed 6:00 PM – 7:00 PM',
    'Thu 11:00 AM – 12:00 PM',
    'Fri 4:00 PM – 5:00 PM',
    'Sat 9:00 AM – 10:00 AM',
  ];

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function formatPrice(amount, currency) {
    if (currency === 'INR') return '₹' + Number(amount).toLocaleString('en-IN');
    return currency + ' ' + Number(amount).toLocaleString();
  }

  function render(course, trainer) {
    if (!trainer) {
      contentEl.innerHTML =
        '<div class="candidate-process-loading">' +
        'Trainer not found. <a href="trainers.html">Select a trainer</a> to start.' +
        '</div>';
      return;
    }
    if (!course && (!trainer.courses || trainer.courses.length === 0)) {
      contentEl.innerHTML =
        '<div class="candidate-process-loading">' +
        'Course not found. <a href="courses.html">Choose a course</a> to start.' +
        '</div>';
      return;
    }
    if (!course && trainer.courses && trainer.courses.length > 0) {
      const firstSlug = trainer.courses[0];
      course = DEMO_COURSES[firstSlug] ? Object.assign({}, DEMO_COURSES[firstSlug], { slug: firstSlug }) : { id: firstSlug, title: firstSlug.replace(/-/g, ' '), price: 0, currency: 'INR', slug: firstSlug };
    }
    if (!course) {
      contentEl.innerHTML =
        '<div class="candidate-process-loading">' +
        'Course not found. <a href="courses.html">Choose a course</a> to start.' +
        '</div>';
      return;
    }

    const hasGroupClass = trainer.hasGroupClass === true;
    const priceText = course.price != null ? formatPrice(course.price, course.currency || 'INR') : 'Price on request';
    const trainerCourses = trainer.courses || [];
    const hasMultipleCourses = !courseSlug && trainerCourses.length > 1;

    const courseSelectorHtml = hasMultipleCourses
      ? (function () {
          var opts = trainerCourses.map(function (slug) {
            var c = DEMO_COURSES[slug] || { title: slug.replace(/-/g, ' ') };
            return '<option value="' + escapeHtml(slug) + '"' + (slug === (course.slug || course.id) ? ' selected' : '') + '>' + escapeHtml(c.title) + '</option>';
          }).join('');
          return '<label class="candidate-schedule-label" style="margin-top:0;">Course</label><select id="courseSelect" class="form-select" style="max-width:320px;">' + opts + '</select>';
        })()
      : '';

    const scheduleOptions = SCHEDULE_SLOTS.map(function (slot, i) {
      const id = 'schedule-' + i;
      return (
        '<label class="candidate-schedule-option">' +
          '<input type="radio" name="schedule" value="' + escapeHtml(slot) + '" id="' + id + '">' +
          '<span class="candidate-schedule-label-inline">' + escapeHtml(slot) + '</span>' +
        '</label>'
      );
    }).join('');

    const noGroupHtml = !hasGroupClass
      ? '<div class="candidate-no-group"><strong>No group discussion available.</strong> This trainer offers one-on-one counselling only.</div>'
      : '';

    const groupSlotPlaceholderId = 'groupSlotOptions';
    const groupStepHtml = hasGroupClass
      ? (
          '<div class="candidate-step" id="groupDiscussionStep">' +
            '<div class="candidate-step-header">' +
              '<span class="candidate-step-num">2</span>' +
              '<h3 class="candidate-step-title">Group discussion</h3>' +
            '</div>' +
            '<div class="candidate-step-body">' +
              '<p style="margin:0 0 0.75rem 0;color:var(--vc-text-muted);font-size:0.9375rem;">Select a time slot for your group discussion session. Slots are synced with Zoho Calendar.</p>' +
              '<div id="' + groupSlotPlaceholderId + '" class="candidate-schedule-options"><span class="candidate-schedule-loading">Loading slots…</span></div>' +
              '<p class="mt-2 small"><a href="https://calendar.zoho.com" target="_blank" rel="noopener">View in Zoho Calendar ↗</a></p>' +
            '</div>' +
          '</div>'
        )
      : '';

    contentEl.innerHTML =
      '<div class="candidate-process-summary">' +
        '<h2>' + escapeHtml(course.title) + ' with ' + escapeHtml(trainer.full_name) + '</h2>' +
        courseSelectorHtml +
        '<p style="margin-top:1rem;">Course fee: ' + escapeHtml(priceText) + ' • Complete the steps below to proceed.</p>' +
      '</div>' +

      '<div class="candidate-process-steps">' +
        '<div class="candidate-step">' +
          '<div class="candidate-step-header">' +
            '<span class="candidate-step-num">1</span>' +
            '<h3 class="candidate-step-title">One-on-one counselling</h3>' +
          '</div>' +
          '<div class="candidate-step-body">' +
            '<p style="margin:0 0 1rem 0;color:var(--vc-text-muted);font-size:0.9375rem;">Select a convenient time for your one-on-one counselling session with the trainer.</p>' +
            '<label class="candidate-schedule-label">Select your schedule</label>' +
            '<div class="candidate-schedule-options">' + scheduleOptions + '</div>' +
            noGroupHtml +
          '</div>' +
        '</div>' +
        groupStepHtml +
      '</div>' +

      '<div class="candidate-payment-section">' +
        '<h3 class="candidate-payment-title">Payment option</h3>' +
        '<div class="candidate-payment-options">' +
          '<label class="candidate-payment-option">' +
            '<input type="radio" name="payment" value="after_counselling" checked>' +
            '<div class="candidate-payment-option-body">' +
              '<h4>Pay after counselling</h4>' +
              '<p>Complete your one-on-one session first. Pay the course fee before accessing materials and group class.</p>' +
            '</div>' +
          '</label>' +
          '<label class="candidate-payment-option">' +
            '<input type="radio" name="payment" value="direct_pay">' +
            '<div class="candidate-payment-option-body">' +
              '<h4>Direct pay</h4>' +
              '<p>Pay now to confirm your slot. Full access after payment.</p>' +
            '</div>' +
          '</label>' +
        '</div>' +
      '</div>' +

      '<div class="candidate-process-actions">' +
        '<button type="button" class="btn-candidate-proceed" id="btnProceed">Proceed</button>' +
        '<a href="' + (courseSlug ? 'trainers.html?course=' + encodeURIComponent(courseSlug) : 'courses.html') + '" class="btn-candidate-back">← Back</a>' +
      '</div>';

    var courseSelectEl = document.getElementById('courseSelect');
    if (courseSelectEl) {
      courseSelectEl.addEventListener('change', function () {
        var slug = this.value;
        var c = DEMO_COURSES[slug];
        if (c) {
          var priceEl = contentEl.querySelector('.candidate-process-summary p');
          if (priceEl) priceEl.innerHTML = 'Course fee: ' + formatPrice(c.price, c.currency || 'INR') + ' • Complete the steps below to proceed.';
          course = c;
          course.slug = slug;
        }
      });
    }

    if (hasGroupClass && trainerId) {
      (function loadGroupSlots() {
        if (typeof window.api === 'undefined') {
          var el = document.getElementById(groupSlotPlaceholderId);
          if (el) el.innerHTML = SCHEDULE_SLOTS.map(function (s, i) {
            return '<label class="candidate-schedule-option"><input type="radio" name="group_schedule" value="' + escapeHtml(s) + '"><span class="candidate-schedule-label-inline">' + escapeHtml(s) + '</span></label>';
          }).join('');
          return;
        }
        window.api.get('/calendar/group-slots?trainer=' + encodeURIComponent(trainer.id || trainerId))
          .then(function (data) {
            var slots = data.slots || SCHEDULE_SLOTS;
            var el = document.getElementById(groupSlotPlaceholderId);
            if (el) el.innerHTML = slots.map(function (s) {
              return '<label class="candidate-schedule-option"><input type="radio" name="group_schedule" value="' + escapeHtml(s) + '"><span class="candidate-schedule-label-inline">' + escapeHtml(s) + '</span></label>';
            }).join('');
          })
          .catch(function () {
            var el = document.getElementById(groupSlotPlaceholderId);
            if (el) el.innerHTML = SCHEDULE_SLOTS.map(function (s) {
              return '<label class="candidate-schedule-option"><input type="radio" name="group_schedule" value="' + escapeHtml(s) + '"><span class="candidate-schedule-label-inline">' + escapeHtml(s) + '</span></label>';
            }).join('');
          });
      })();
    }

    document.getElementById('btnProceed').addEventListener('click', function () {
      const schedule = document.querySelector('input[name="schedule"]:checked');
      const payment = document.querySelector('input[name="payment"]:checked');
      const groupSchedule = document.querySelector('input[name="group_schedule"]:checked');
      const scheduleVal = schedule ? schedule.value : '';
      const paymentVal = payment ? payment.value : 'after_counselling';
      const groupVal = groupSchedule ? groupSchedule.value : null;
      if (!scheduleVal) {
        alert('Please select a schedule for your counselling session.');
        return;
      }
      if (hasGroupClass && !groupVal) {
        alert('Please select a group discussion slot.');
        return;
      }
      var btn = this;
      btn.disabled = true;
      if (typeof window.api === 'undefined' || !window.api.isLoggedIn || !window.api.isLoggedIn()) {
        window.location.href = 'login.html?redirect=' + encodeURIComponent('candidate-process.html' + (window.location.search || ''));
        return;
      }

      function doEnroll(opt) {
        window.api.post('/student/enroll', {
          trainer_id: trainer.slug || trainer.id || trainerId,
          course_id: course.id || course.slug || courseSlug,
          counselling_slot: scheduleVal,
          group_slot: groupVal,
          payment_option: opt || paymentVal,
        }).then(function () {
          alert(opt === 'direct_pay' ? 'Payment successful! Enrollment confirmed.' : 'Enrollment submitted. The trainer will contact you to confirm your slot.');
          window.location.href = 'dashboard.html';
        }).catch(function (err) {
          btn.disabled = false;
          alert(err.error || 'Enrollment failed. Please try again.');
        });
      }

      if (paymentVal === 'direct_pay' && (course.price > 0 || (course.price === 0 && course.id))) {
        window.api.post('/payment/create-order', {
          course_id: course.slug || course.id,
          trainer_id: trainer.slug || trainer.id || trainerId,
          amount: course.price,
        }).then(function (orderData) {
          if (orderData.demo && !orderData.key_id) {
            window.api.post('/payment/verify', {
              razorpay_order_id: orderData.order_id,
              razorpay_payment_id: 'demo_pay_' + Date.now(),
              razorpay_signature: 'demo',
              course_id: course.slug || course.id,
              trainer_id: trainer.slug || trainer.id || trainerId,
            }).then(function () {
              doEnroll('direct_pay');
            }).catch(function (e) {
              btn.disabled = false;
              alert(e.error || 'Verification failed');
            });
            return;
          }
          var options = {
            key: orderData.key_id,
            amount: orderData.amount,
            currency: orderData.currency || 'INR',
            name: 'Vision Connects',
            description: course.title,
            order_id: orderData.order_id,
            handler: function (response) {
              window.api.post('/payment/verify', {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                course_id: course.slug || course.id,
                trainer_id: trainer.slug || trainer.id || trainerId,
              }).then(function () {
                doEnroll('direct_pay');
              }).catch(function (e) {
                btn.disabled = false;
                alert(e.error || 'Payment verification failed');
              });
            },
          };
          var rzp = new Razorpay(options);
          rzp.on('payment.failed', function () {
            btn.disabled = false;
            alert('Payment failed. Please try again.');
          });
          rzp.open();
        }).catch(function (err) {
          btn.disabled = false;
          alert(err.error || 'Could not create payment. Try "Pay after counselling" instead.');
        });
      } else {
        doEnroll();
      }
    });
  }

  function loadData() {
    let course = courseSlug && DEMO_COURSES[courseSlug] ? DEMO_COURSES[courseSlug] : null;
    let trainer = trainerId && DEMO_TRAINERS[trainerId] ? DEMO_TRAINERS[trainerId] : null;

    if (typeof window.api !== 'undefined') {
      const promises = [];
      if (courseSlug) promises.push(window.api.get('/courses/' + encodeURIComponent(courseSlug)));
      if (trainerId) promises.push(window.api.get('/trainers/' + encodeURIComponent(trainerId)));
      if (promises.length > 0) {
        Promise.all(promises)
          .then(function (results) {
            if (results[0] && results[0].slug) course = results[0];
            if (results[1] && results[1].id) trainer = results[1];
            render(course, trainer);
          })
          .catch(function () {
            render(course, trainer);
          });
      } else {
        render(course, trainer);
      }
    } else {
      render(course, trainer);
    }
  }

  if (!contentEl) return;

  var redirect = 'candidate-process.html' + (window.location.search || '');
  if (typeof window.api !== 'undefined' && window.api.isLoggedIn && !window.api.isLoggedIn()) {
    window.location.href = 'login.html?redirect=' + encodeURIComponent(redirect);
    return;
  }

  if (breadcrumbEl) breadcrumbEl.textContent = 'Enrollment';
  loadData();
})();
