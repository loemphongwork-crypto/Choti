// แปลง URL (#/...) เป็นหน้าที่ต้องแสดง — ไม่แตะ DOM เพื่อให้ทดสอบได้
const ROUTES = [
  ['t', 'teacher-home', []],
  ['t/c/:sectionId', 'checkin'],
  ['t/h/:sectionId', 'history'],
  ['t/w/a/:assignmentId', 'assignment'],
  ['t/w/:sectionId', 'work'],
  ['t/set', 'settings'],
  ['s', 'student-home'],
  ['s/a/:assignmentId', 'submit'],
  ['join/:classroomId', 'join'],
];

export function parse(hash, search) {
  const path = String(hash || '').replace(/^#\/?/, '').replace(/\/+$/, '');
  if (!path) {
    const p = new URLSearchParams(search || '');
    return { view: p.get('p') === 'teacher' ? 'teacher-home' : 'student-home', params: {} };
  }
  const segs = path.split('/');
  for (const [pattern, view] of ROUTES) {
    const ps = pattern.split('/');
    if (ps.length !== segs.length) continue;
    const params = {};
    const ok = ps.every((p, i) => {
      if (p.startsWith(':')) { params[p.slice(1)] = decodeURIComponent(segs[i]); return true; }
      return p === segs[i];
    });
    if (ok) return { view, params };
  }
  return { view: 'student-home', params: {} };
}

export function go(hash) { location.hash = hash; }
