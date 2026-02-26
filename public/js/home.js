/**
 * Home page – interactive role selector, stats animation (unique to home).
 */

(function () {
  var roleTabs = document.querySelectorAll('.hero-role-tab');
  var roleDesc = document.getElementById('heroRoleDesc');
  var roleCta = document.getElementById('heroRoleCta');

  var roleContent = {
    learn: {
      desc: 'Browse courses, choose a trainer, and enroll after secure payment. Fixed prices—no surprises.',
      cta: 'Explore courses',
      href: 'courses.html',
    },
    teach: {
      desc: 'Get approved as a trainer and teach accounting courses. No pricing hassle—the platform sets prices.',
      cta: 'Become a trainer',
      href: 'register.html',
    },
    hire: {
      desc: 'Post jobs and find candidates. Pay once for access, then search and shortlist students.',
      cta: 'Post jobs',
      href: 'jobs.html',
    },
  };

  if (roleTabs.length && roleDesc && roleCta) {
    roleTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var role = this.getAttribute('data-role');
        if (!role || !roleContent[role]) return;
        roleTabs.forEach(function (t) {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        this.classList.add('active');
        this.setAttribute('aria-selected', 'true');
        roleDesc.textContent = roleContent[role].desc;
        roleCta.textContent = roleContent[role].cta;
        roleCta.href = roleContent[role].href;
      });
    });
  }

  // Optional: animate stat numbers on load
  var statNums = document.querySelectorAll('.stat-num');
  function animateStat(el) {
    var target = parseInt(el.getAttribute('data-target'), 10) || 0;
    var duration = 1200;
    var start = 0;
    var startTime = null;
    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var ease = 1 - Math.pow(1 - progress, 2);
      var current = Math.floor(start + (target - start) * ease);
      el.textContent = current;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target;
    }
    requestAnimationFrame(step);
  }

  function runStatsWhenVisible() {
    if (!statNums.length) return;
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateStat(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 }
    );
    statNums.forEach(function (el) { observer.observe(el); });
  }

  if (typeof requestAnimationFrame !== 'undefined' && statNums.length) {
    if (typeof IntersectionObserver !== 'undefined') {
      runStatsWhenVisible();
    } else {
      statNums.forEach(function (el) {
        el.textContent = el.getAttribute('data-target') || '0';
      });
    }
  }
})();
