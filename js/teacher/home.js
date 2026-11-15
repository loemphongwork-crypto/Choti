// ครู: หน้าเลือกห้อง (แต่ละห้องมีปุ่ม เช็คชื่อ / งาน / อื่น ๆ)
import { T, cacheGet, cacheSet, giveHandoff } from '../api.js';
import { h, sheet, header, errorBox } from '../ui.js';
import { fmtClock, clockToMs } from '../period.js';

export async function render(app) {
  const body = h('div', { class: 'body pad' });
  app.append(header({
    title: 'คาบวันนี้', sub: 'เลือกห้องที่จะสอน',
    right: h('button', { class: 'pill', style: 'background:#f1f2f5', onclick: () => { location.hash = '#/t/set'; } }, '⚙ ตั้งค่า'),
  }), body);
  // แสดงข้อมูลที่จำไว้ทันที แล้วค่อยอัปเดตจากระบบ
  const cached = cacheGet('tHome');
  if (cached) paint(body, cached); else body.append(h('div', { class: 'loading' }, 'กำลังโหลดห้อง…'));
  try {
    const d = await T('tHome', {});
    cacheSet('tHome', d);
    paint(body, d);
  } catch (e) { if (!cached) body.replaceChildren(errorBox(e)); }
}

function paint(body, d) {
  const rooms = Object.fromEntries(d.classrooms.map((c) => [c.id, c]));
  const courses = d.courses.filter((c) => !d.activeTermId || c.termId === d.activeTermId);
  body.replaceChildren();
  if (!courses.length) body.append(h('div', { class: 'empty' }, 'ยังไม่มีวิชา — ไปที่ ⚙ ตั้งค่า เพื่อเพิ่มวิชาและรายชื่อ'));
  for (const co of courses) {
    const secs = d.sections.filter((s) => s.courseId === co.id && rooms[s.classroomId])
      .sort((a, b) => rooms[a.classroomId].name.localeCompare(rooms[b.classroomId].name, 'th', { numeric: true }));
    if (!secs.length) continue;
    body.append(h('div', { class: 'sec-t' }, co.name));
    for (const s of secs) {
      const r = rooms[s.classroomId];
      body.append(h('div', { class: 'room' },
        h('div', { class: 'grow' }, h('b', {}, r.name), h('small', {}, s.openSessionId ? h('span', { class: 'live' }, '● กำลังสอน') : `${r.count} คน`)),
        h('button', { class: 'btn pri', onclick: () => (s.openSessionId ? (location.hash = '#/t/c/' + s.id) : startSheet(s, r, co)) }, '✓ เช็คชื่อ'),
        h('button', { class: 'btn', onclick: () => { location.hash = '#/t/w/' + s.id; } }, '📄 งาน'),
        h('button', { class: 'btn', 'aria-label': 'อื่น ๆ', onclick: () => moreSheet(s, r, co) }, '⋯')));
    }
  }
}

function moreSheet(sec, room, course) {
  const sh = sheet({
    title: `${room.name} · ${course.name}`,
    body: h('div', {},
      h('button', { class: 'opt', onclick: async () => { sh.close(); (await import('./qr.js')).showRoomQR(room); } }, h('span', { class: 't' }, h('b', {}, '▣ QR ห้อง'), h('small', {}, 'ให้นักเรียนสแกนเข้าระบบ'))),
      h('button', { class: 'opt', onclick: () => { sh.close(); location.hash = '#/t/h/' + sec.id; } }, h('span', { class: 't' }, h('b', {}, '✎ แก้เช็คชื่อย้อนหลัง'), h('small', {}, 'ค้นชื่อ → เลือกคาบ → เปลี่ยนสถานะ')))),
    foot: [h('button', { class: 'btn', onclick: () => sh.close() }, 'ปิด')],
  });
}

function startSheet(sec, room, course) {
  const err = h('div');
  const endIn = h('input', { type: 'time', step: 60 });
  const chips = h('div', { class: 'chips' });
  const info = h('div', { class: 'hint', style: 'margin-top:6px' });
  let ref = Date.now(), sug = null, touched = false;
  const paintInfo = () => {
    const end = clockToMs(endIn.value, ref);
    if (!end) { info.textContent = ''; return; }
    const start = sug && sug.planStartAt ? sug.planStartAt : ref;
    info.textContent = sug && sug.planStartAt
      ? `ตามตาราง ${fmtClock(sug.planStartAt)}–${fmtClock(end)} · ครึ่งคาบ ${fmtClock((start + end) / 2)} (นับจากตาราง แม้เริ่มช้า)`
      : `เริ่มนับตอนกดเริ่มคาบ · ครึ่งคาบ ≈ ${fmtClock((start + end) / 2)}`;
  };
  endIn.oninput = () => { touched = true; paintInfo(); };
  chips.replaceChildren(...[40, 45, 50].map((m) => h('button', { class: 'chip', onclick: () => { touched = true; endIn.value = fmtClock(Date.now() + m * 60000); paintInfo(); } }, `อีก ${m} นาที`)));
  // ค่าเริ่มต้นทันทีจากความยาวที่ใช้ล่าสุด แล้วค่อยปรับตามตารางเมื่อระบบตอบ
  endIn.value = fmtClock(Date.now() + (sec.periodMinutes || 50) * 60000);
  paintInfo();
  const go = h('button', { class: 'btn pri' }, 'เริ่มคาบ');
  const sh = sheet({
    title: `${room.name} · ${course.name}`, sub: 'เวลาเริ่ม = ตอนกดปุ่มนี้ · ตั้งเวลาจบคาบ (แก้ระหว่างคาบได้)',
    body: h('div', {}, h('label', { class: 'field', style: 'margin-bottom:6px' }, h('span', {}, 'เวลาจบคาบ'), endIn), chips, info, err),
    foot: [h('button', { class: 'btn', onclick: () => sh.close() }, 'ยกเลิก'), go],
  });
  T('periodSuggest', { sectionId: sec.id }).then((r) => {
    sug = r; ref = r.serverNow;
    if (!touched) endIn.value = fmtClock(r.endAt);
    paintInfo();
  }).catch(() => {});
  go.onclick = async () => {
    const end = clockToMs(endIn.value, Date.now());
    if (!end || end <= Date.now()) { err.replaceChildren(errorBox('เวลาจบคาบต้องเป็นเวลาหลังจากตอนนี้')); return; }
    go.disabled = true; go.textContent = 'กำลังเริ่ม…'; err.replaceChildren();
    try {
      const view = await T('startSession', { sectionId: sec.id, planEndAt: end });
      giveHandoff('cv:' + sec.id, view);
      sh.close();
      location.hash = '#/t/c/' + sec.id;
    } catch (e) { err.replaceChildren(errorBox(e)); go.disabled = false; go.textContent = 'เริ่มคาบ'; }
  };
}
