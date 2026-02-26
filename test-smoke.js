/**
 * Smoke tests for LMS API - run with: node test-smoke.js
 */
const base = 'http://localhost:3000';

async function req(method, path, body, cookie) {
  const url = base + path;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  if (cookie) opts.headers.Cookie = cookie;
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: Object.fromEntries(res.headers.entries()) };
}

async function run() {
  const results = [];
  function ok(name, pass, detail = '') {
    results.push({ name, pass, detail });
    console.log(pass ? 'PASS' : 'FAIL', name, detail || '');
  }

  // 1. Health
  const h = await req('GET', '/health');
  ok('Health endpoint', h.status === 200 && h.data?.status === 'ok');

  // 2. Auth config
  const cfg = await req('GET', '/api/auth/config');
  ok('Auth config', cfg.status === 200);

  // 3. Login (demo student)
  const login = await req('POST', '/api/auth/login', {
    email: 'demo-student@visionconnects.com',
    password: 'password123',
  });
  ok('Login', login.status === 200 && login.data?.user?.role === 'student');
  const setCookie = login.headers['set-cookie'];
  const setCookieRaw = login.headers['set-cookie'] || login.headers['Set-Cookie'];
  const parts = Array.isArray(setCookieRaw) ? setCookieRaw : (setCookieRaw ? [setCookieRaw] : []);
  const cookieStr = parts.map((c) => String(c).split(';')[0].trim()).filter(Boolean).join('; ');

  // 4. Auth me (with cookie)
  const me = await req('GET', '/api/auth/me', null, cookieStr);
  ok('Auth /me', me.status === 200 && me.data?.user?.email);

  // 5. Logout
  const logout = await req('POST', '/api/auth/logout', null, cookieStr);
  ok('Logout', logout.status === 200);

  // 6. Auth me after logout (should 401)
  const meAfter = await req('GET', '/api/auth/me');
  ok('Auth /me after logout returns 401', meAfter.status === 401);

  // 7. Courses
  const courses = await req('GET', '/api/courses');
  ok('Courses list', courses.status === 200 && (courses.data?.courses?.length >= 0 || Array.isArray(courses.data?.courses)));

  // 8. Trainers
  const trainers = await req('GET', '/api/trainers');
  ok('Trainers list', trainers.status === 200 && (trainers.data?.trainers?.length >= 0 || Array.isArray(trainers.data?.trainers)));

  // 9. Jobs
  const jobs = await req('GET', '/api/jobs');
  ok('Jobs list', jobs.status === 200);

  // 10. Login as admin
  const adminLogin = await req('POST', '/api/auth/login', {
    email: 'admin@visionconnects.com',
    password: 'password123',
  });
  ok('Admin login', adminLogin.status === 200 && adminLogin.data?.user?.role === 'super_admin');

  // 11. Trainer login
  const trainerLogin = await req('POST', '/api/auth/login', {
    email: 'demo-trainer@visionconnects.com',
    password: 'password123',
  });
  ok('Trainer login', trainerLogin.status === 200 && trainerLogin.data?.user?.role === 'trainer');

  // 12. Invalid login
  const badLogin = await req('POST', '/api/auth/login', {
    email: 'wrong@example.com',
    password: 'wrong',
  });
  ok('Invalid login returns 401', badLogin.status === 401);

  // 13. Calendar group slots
  const slots = await req('GET', '/api/calendar/group-slots?trainer=tr-1');
  ok('Calendar group slots', slots.status === 200 && Array.isArray(slots.data?.slots));

  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  console.log('\n' + passed + '/' + total + ' tests passed');
  process.exit(passed === total ? 0 : 1);
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
