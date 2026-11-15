// ครู: เลือกห้อง → เริ่มคาบ
import { T } from '../api.js';
import { h, sheet, header, errorBox } from '../ui.js';
import { fmtClock, clockToMs } from '../period.js';

export async function render(app) {
  const body = h('div', { class: 'body pad' }, h('div', { class: 'loading' }, 'กำลังโหลดห้อง…'));
  app.append(header({
    title: 'คาบวันนี้', sub: 'แตะห้องเพื่อเริ่มคาบ',
    right: h('button', { class: 'pill', style: 'background:#f1f2f5', onclick: () => { location.hash = '#/t/set'; } }, '⚙ ตั้งค่า'),
  }), body);

  let d;
  try { d = await T('tHome', {}); } catch (e) { body.replaceChildren(errorBox(e)); return; }
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
      body.append(h('button', { class: 'room', onclick: () => (s.openSessionId ? (location.hash = '#/t/c/' + s.id) : startSheet(s, r, co)) },
        h('div', { class: 'grow' }, h('b', {}, r.name), h('small', {}, `${r.count} คน`)),
        s.openSessionId ? h('span', { class: 'live' }, '● กำลังสอน') : h('span', { class: 'hint' }, 'เริ่มคาบ ›')));
    }
  }
}

async function startSheet(sec, room, course) {
  const err = h('div');
  const endIn = h('input', { type: 'time', step: 60 });
  const chips = h('div', { class: 'chips' });
  const info = h('div', { class: 'hint', style: 'margin-top:6px' }, 'กำลังดูตารางเวลา…');
  let ref = Date.now(), sug = null;
  const paintInfo = () => {
    const end = clockToMs(endIn.value, ref);
    if (!end) { info.textContent = ''; return; }
    const start = sug && sug.planStartAt ? sug.planStartAt : ref;
    info.textContent = sug && sug.planStartAt
      ? `ตามตาราง ${fmtClock(sug.planStartAt)}–${fmtClock(end)} · ครึ่งคาบ ${fmtClock((start + end) / 2)} (นับจากตาราง แม้เริ่มช้า)`
      : `เริ่มนับตอนกดเริ่มคาบ · ครึ่งคาบ ≈ ${fmtClock((start + end) / 2)}`;
  };
  endIn.oninput = paintInfo;
  chips.replaceChildren(...[40, 45, 50].map((m) => h('button', { class: 'chip', onclick: () => { endIn.value = fmtClock(Date.now() + m * 60000); paintInfo(); } }, `อีก ${m} นาที`)));
  const go = h('button', { class: 'btn pri' }, 'เริ่มคาบ');
  const sh = sheet({
    title: `${room.name} · ${course.name}`, sub: 'เวลาเริ่ม = ตอนกดปุ่มนี้ · ตั้งเวลาจบคาบ (แก้ระหว่างคาบได้)',
    body: h('div', {},
      h('label', { class: 'field', style: 'margin-bottom:6px' }, h('span', {}, 'เวลาจบคาบ'), endIn), chips, info, err,
      h('div', { style: 'display:flex;gap:6px;margin-top:14px' },
        h('button', { class: 'btn', style: 'flex:1', onclick: () => { sh.close(); location.hash = '#/t/w/' + sec.id; } }, '📄 งานของห้อง'),
        h('button', { class: 'btn', style: 'flex:1', onclick: () => { sh.close(); location.hash = '#/t/h/' + sec.id; } }, '✎ แก้ย้อนหลัง'),
        h('button', { class: 'btn', style: 'flex:1', onclick: async () => { (await import('./qr.js')).showRoomQR(room); } }, '▣ QR ห้อง'))),
    foot: [h('button', { class: 'btn', onclick: () => sh.close() }, 'ยกเลิก'), go],
  });
  try {
    sug = await T('periodSuggest', { sectionId: sec.id });
    ref = sug.serverNow; endIn.value = fmtClock(sug.endAt);
  } catch (e) { endIn.value = fmtClock(Date.now() + 50 * 60000); }
  paintInfo();
  go.onclick = async () => {
    const end = clockToMs(endIn.value, Date.now());
    if (!end || end <= Date.now()) { err.replaceChildren(errorBox('เวลาจบคาบต้องเป็นเวลาหลังจากตอนนี้')); return; }
    go.disabled = true; err.replaceChildren();
    try {
      await T('startSession', { sectionId: sec.id, planEndAt: end });
      sh.close();
      location.hash = '#/t/c/' + sec.id;
    } catch (e) { err.replaceChildren(errorBox(e)); go.disabled = false; }
  };
}
