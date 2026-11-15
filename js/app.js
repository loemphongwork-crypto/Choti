// จุดเริ่มของหน้าเว็บ: อ่าน URL → โหลดหน้าที่ตรงกัน
import { parse } from './router.js';
import { store, call } from './api.js';
import { h, $app } from './ui.js';

const VIEWS = {
  'teacher-home': './teacher/home.js',
  checkin: './teacher/checkin.js',
  history: './teacher/history.js',
  work: './teacher/work.js',
  assignment: './teacher/work.js',
  settings: './teacher/settings.js',
  'music-trial': './music/teacher.js',
  'student-home': './student/home.js',
  submit: './student/submit.js',
  join: './student/join.js',
};
const TEACHER = new Set(['teacher-home', 'checkin', 'history', 'work', 'assignment', 'settings', 'music-trial']);

let seq = 0, cleanup = null;
async function route() {
  const my = ++seq;
  if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
  const { view, params } = parse(location.hash, location.search);
  const app = $app();
  app.replaceChildren(h('div', { class: 'loading' }, 'กำลังโหลด…'));
  try {
    let mod;
    if (TEACHER.has(view) && !store.get('tTok')) mod = await import('./teacher/login.js');
    else mod = await import(VIEWS[view]);
    if (my !== seq) return;
    app.replaceChildren();
    const done = await mod.render(app, params, view);
    if (typeof done === 'function') { if (my === seq) cleanup = done; else done(); }
  } catch (e) {
    if (my !== seq) return;
    app.replaceChildren(h('div', { class: 'loading' }, 'เปิดหน้านี้ไม่ได้: ' + (e.message || e)));
  }
}

// ปลุกหลังบ้าน (Apps Script) ทันทีที่เปิดแอป จะได้ไม่ช้าตอนกดปุ่มแรก
call('teacherStatus', {}).catch(() => {});
// มีคำสั่งค้างส่งจากครั้งก่อน (เช่น ปิดคาบตอนเน็ตหลุด) → ส่งต่อทันทีที่เปิดแอป และทุกครั้งที่เน็ตกลับมา
if (store.get('tTok')) {
  import('./queue.js').then(({ createQueue, LOCAL }) => import('./api.js').then(({ T }) => {
    const q = createQueue(LOCAL, (op) => T(op.name, op.args));
    q.flush();
    window.addEventListener('online', () => q.flush());
  })).catch(() => {});
}

window.addEventListener('hashchange', route);
route();
