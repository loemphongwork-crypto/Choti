// ครู: หน้าการ์ดเช็คชื่อ (แตะ = ตามกล่องสี · กดค้าง = เมนูอื่น)
import { T, takeHandoff, cacheSet } from '../api.js';
import { roomInfo } from './room-info.js';
import { h, sheet, toast, press, header, errorBox } from '../ui.js';
import { createQueue } from '../queue.js';
import { fmtClock, clockToMs, elapsed, endOf, halfAt } from '../period.js';
import { LABEL, tapAction, phaseOf, countStatuses, matchStudent, noteArg } from './checkin-state.js';

const STORE = { getItem: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, setItem: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }, removeItem: () => {} };
const DOT = { P: 'var(--ok)', L: 'var(--l1)', M: 'var(--l2)', S: 'var(--leave)', E: 'var(--act)', A: 'var(--abs)', '': '#c9ced6' };

const PALETTE = ['#e6553a', '#2f8fdd', '#27a35a', '#d59b00', '#8b5cc7', '#d6457f', '#169c9c', '#5b6ee1', '#c25e00'];
function initial(st) { return Array.from(String(st.nick || st.firstName || '?').replace(/[ัิ-ฺเ-ไ็-๎]/g, ''))[0] || '?'; }
function avatarColor(st) { let x = 0; for (const ch of String(st.id)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return PALETTE[x % PALETTE.length]; }

export async function render(app, { sectionId }) {
  app.append(h('div', { class: 'loading' }, 'กำลังโหลดรายชื่อ…'));
  // เพิ่งกดเริ่มคาบ = มีข้อมูลส่งต่อมาแล้ว ไม่ต้องโหลดซ้ำ · ไม่งั้นโหลดครั้งเดียวด้วย checkinView
  let d = takeHandoff('cv:' + sectionId);
  if (!d) {
    try { d = await T('checkinView', { sectionId }); } catch (e) { app.replaceChildren(errorBox(e)); return; }
  }
  if (!d.session) { app.replaceChildren(header({ title: d.classroom.name, sub: d.course.name, back: '#/t' }), h('div', { class: 'empty' }, 'ยังไม่ได้เริ่มคาบ — กลับไปหน้าห้องแล้วกด "✓ เช็คชื่อ"')); return; }
  const sv = { classroom: d.classroom, course: d.course, students: d.students };
  cacheSet('room:' + sectionId, roomInfo(d));
  const ss = { session: d.session, attendance: d.attendance, serverNow: d.serverNow };

  const sessionId = ss.session.id;
  let session = ss.session;
  const offset = ss.serverNow - Date.now();
  const now = () => Date.now() + offset;
  const students = sv.students;
  const att = {}; // studentId → {status, note}
  ss.attendance.forEach((a) => { att[a.studentId] = { status: a.status, note: a.note || '' }; });

  const queue = createQueue(STORE, (op) => T(op.name, op.args), (e) => toast('บันทึกไม่สำเร็จ: ' + e.message));
  // การแตะที่ยังค้างในคิว (เช่น เน็ตหลุดแล้วรีเฟรช) ทับข้อมูลจากเซิร์ฟเวอร์
  try {
    JSON.parse(localStorage.getItem('q:v1') || '[]').forEach((op) => {
      if (op.args.sessionId !== sessionId) return;
      if (op.name === 'setAttendance' && op.args.studentId) att[op.args.studentId] = { status: op.args.status, note: op.args.note || '' };
      if (op.name === 'markOnTimeDone') session = Object.assign({}, session, { onTimeEndAt: op.args.undo ? null : op.args.clientTime });
    });
  } catch (e) { /* ignore */ }

  const undoStack = [];
  let query = '';

  // ---------- โครงหน้าจอ ----------
  const sync = h('span', { class: 'pill sync ok' }, '✓ บันทึกแล้ว');
  const timeLine = h('button', { class: 'linkish', style: 'color:var(--mute);font-size:12.5px;padding:0;text-align:left' });
  const phase = h('div', { class: 'phase' });
  const counts = h('div', { class: 'counts' });
  // สวิตช์ "รูป": แสดงรูปนักเรียนบนการ์ด (ยังไม่มีรูป = ตัวอักษรย่อ)
  let photoOn = STORE.getItem('photoMode') === '1';
  const photoBtn = h('button', { class: 'phtog' + (photoOn ? ' on' : ''), title: 'แสดงรูปบนการ์ด', onclick: () => {
    photoOn = !photoOn; STORE.setItem('photoMode', photoOn ? '1' : '0');
    photoBtn.classList.toggle('on', photoOn); grid.classList.toggle('photo', photoOn); if (photoOn) loadPhotos();
  } }, h('span', { class: 'sw' }, h('span', { class: 'knob' })), 'รูป');
  const countRow = h('div', { class: 'countrow' }, counts, photoBtn);
  const clock = h('div', { class: 'clock', 'aria-live': 'off' });
  const hd = h('div', { class: 'hd' },
    h('div', { class: 'hrow' },
      h('button', { class: 'back', onclick: () => { location.hash = '#/t'; }, 'aria-label': 'ย้อนกลับ' }, '‹'),
      h('div', { class: 'cls' }, h('b', {}, `${sv.classroom.name} · ${sv.course.name}`), timeLine), sync),
    clock, phase, countRow);
  let wasHalf = null;
  const isHalf = () => now() > halfAt(session);
  function tickClock() {
    const e = elapsed(session.startAt, endOf(session), now());
    clock.className = 'clock' + (e.over ? ' over' : '');
    clock.replaceChildren(
      h('span', {}, '⏱ ผ่านไป ', h('b', {}, e.passed)),
      e.over ? h('span', {}, 'หมดคาบแล้ว ', h('b', {}, '+' + e.over)) : h('span', {}, 'เหลือ ', h('b', {}, e.left)));
    const half = isHalf();
    if (wasHalf !== null && half !== wasHalf) paintHead(); // เพิ่งเลยครึ่งคาบ: เปลี่ยนกล่องสีทันที
    wasHalf = half;
  }
  const search = h('input', { placeholder: 'ค้นเลขที่ / ชื่อเล่น / ชื่อจริง', oninput: () => { query = search.value; paintGrid(); } });
  const searchBox = h('div', { class: 'searchbox', style: 'display:none' }, search);
  const grid = h('div', { class: 'grid' });
  const body = h('div', { class: 'body' }, searchBox, grid);
  const undoBtn = h('button', { class: 'bb', disabled: true, onclick: undo }, h('span', { class: 'i' }, '↶'), 'ย้อน');
  const bbar = h('div', { class: 'bbar' }, undoBtn,
    h('button', { class: 'bb', onclick: () => { const on = searchBox.style.display === 'none'; searchBox.style.display = on ? '' : 'none'; if (on) search.focus(); else { search.value = ''; query = ''; paintGrid(); } } }, h('span', { class: 'i' }, '🔍'), 'ค้นชื่อ'),
    h('button', { class: 'bb', onclick: () => { location.hash = '#/t/w/' + sectionId; } }, h('span', { class: 'i' }, '📄'), 'สั่งงาน'),
    h('span', { class: 'spacer' }),
    h('button', { class: 'bb wide', onclick: closeFlow }, '■ ปิดคาบ'));
  app.replaceChildren(hd, body, bbar);

  // ---------- วาด ----------
  const cards = {};
  for (const st of students) {
    const c = h('div', { class: 'card', role: 'button', tabindex: 0 },
      h('span', { class: 'no' }, st.no ?? ''), h('span', { class: 'mark' }),
      h('div', { class: 'pic', style: 'background:' + avatarColor(st) }, h('span', { class: 'ini' }, initial(st))),
      h('div', { class: 'nick' }, st.nick || st.firstName), h('div', { class: 'nm' }, `${st.firstName} ${st.lastName}`), h('div', { class: 'st' }));
    press(c, () => onTap(st), () => onHold(st));
    cards[st.id] = c;
    grid.append(c);
  }
  function paintCard(st) {
    const a = att[st.id] || { status: '' };
    const c = cards[st.id];
    c.className = 'card' + (a.status ? ' s-' + a.status : '');
    c.querySelector('.st').textContent = LABEL[a.status] || '';
    c.querySelector('.mark').textContent = a.note ? '⏱' : '';
    c.title = a.note || '';
  }
  let photosLoaded = false;
  async function loadPhotos() {
    if (photosLoaded) return;
    photosLoaded = true;
    try {
      const map = await T('studentPhotos', { classroomId: sv.classroom.id });
      for (const [id, src] of Object.entries(map)) {
        const pic = cards[id] && cards[id].querySelector('.pic');
        if (pic) pic.replaceChildren(h('img', { src, alt: '' }));
      }
    } catch (e) { photosLoaded = false; }
  }
  function paintGrid() { students.forEach((st) => { paintCard(st); cards[st.id].classList.toggle('hide', !matchStudent(st, query)); }); }
  function paintHead() {
    const half = isHalf();
    const ph = phaseOf(session);
    timeLine.textContent = `เริ่ม ${fmtClock(session.startAt)} · จบ ${fmtClock(endOf(session))} · ครึ่งคาบ ${fmtClock(halfAt(session))} ✎`;
    timeLine.onclick = periodSheet;
    phase.className = 'phase' + (half ? ' late' : ph === 'after' ? ' p2' : '');
    const btn = ph === 'round1' && !half
      ? h('div', { class: 'pbtn' }, h('button', { onclick: endRound1 }, 'บันทึก'), h('small', {}, 'จบเรียกชื่อรอบแรก'))
      : null;
    phase.replaceChildren(h('div', { class: 'pl' },
      h('div', { class: 'tapmean' }, 'แตะ = ', h('em', {}, half ? 'มา' : ph === 'round1' ? 'มา' : 'สาย 1 / 2')),
      h('div', { class: 'psub' }, half ? 'เกินครึ่งคาบแล้ว — บันทึกเป็นมา พร้อมหมายเหตุให้เอง' : ph === 'round1' ? 'กดค้างการ์ด = ลา · กิจกรรม · ขาด' : 'แตะแล้วเลือก สาย 1 หรือ สาย 2')), ...(btn ? [btn] : []));
    const c = countStatuses(students.map((s) => att[s.id] || { status: '' }), students.length);
    counts.replaceChildren(
      h('span', { class: 'cnt c-ok' }, 'มา ', h('b', {}, c.P)), h('span', { class: 'cnt c-l' }, 'สาย 1 ', h('b', {}, c.L)), h('span', { class: 'cnt c-l2' }, 'สาย 2 ', h('b', {}, c.M)),
      h('span', { class: 'cnt c-lv' }, 'ลา ', h('b', {}, c.S)), h('span', { class: 'cnt c-act' }, 'กิจกรรม ', h('b', {}, c.E)), h('span', { class: 'cnt c-abs' }, 'ขาด ', h('b', {}, c.A)),
      h('span', { class: 'cnt' }, 'ยังไม่เช็ค ', h('b', {}, c.none)));
  }
  function paintSync(n) {
    n = n ?? queue.pending();
    sync.className = 'pill sync ' + (n ? 'off' : 'ok');
    sync.textContent = n ? `รอส่ง ${n}` : '✓ บันทึกแล้ว';
  }
  paintGrid(); paintHead(); paintSync();
  if (photoOn) { grid.classList.add('photo'); loadPhotos(); }
  queue.onChange(paintSync);

  // ---------- การกระทำ ----------
  function setStatus(st, status, note) {
    const prev = att[st.id] || { status: '', note: '' };
    undoStack.push({ st, prev });
    undoBtn.disabled = false;
    const half = status && ['P', 'L', 'M'].includes(status) && isHalf();
    att[st.id] = { status, note: note !== undefined ? note : (half ? `มาเกินครึ่งคาบ (${fmtClock(now())})` : '') };
    const args = { sessionId, studentId: st.id, status };
    if (note !== undefined) args.note = note;
    queue.push({ name: 'setAttendance', args });
    paintCard(st); paintHead();
    queue.flush();
  }
  function onTap(st) {
    const act = tapAction(att[st.id] || { status: '' }, phaseOf(session), isHalf());
    if (!act) { toast(`${st.nick || st.firstName} เช็คแล้ว — กดค้างเพื่อแก้`); return; }
    if (act.status) { setStatus(st, act.status); return; }
    const sh = sheet({
      title: `${st.no ?? ''} ${st.nick || st.firstName}`, sub: 'มาสาย — เลือกแบบ',
      body: h('div', {}, ...act.ask.map((s) => h('button', { class: 'opt', onclick: () => { sh.close(); setStatus(st, s); } }, h('span', { class: 'dot', style: 'background:' + DOT[s] }), h('span', { class: 't' }, h('b', {}, LABEL[s]))))),
      foot: [h('button', { class: 'btn', onclick: () => sh.close() }, 'ยกเลิก')],
    });
  }
  function onHold(st) {
    const cur = att[st.id] || { status: '', note: '' };
    const note = h('input', { placeholder: 'หมายเหตุ (ไม่บังคับ) เช่น ป่วย / แข่งกีฬา', value: cur.note || '' });
    const opts = ['P', 'L', 'M', 'S', 'E', 'A', ''].map((s) => h('button', { class: 'opt', onclick: () => { sh.close(); setStatus(st, s, noteArg(note.value, cur.note)); } },
      h('span', { class: 'dot', style: 'background:' + DOT[s] }), h('span', { class: 't' }, h('b', {}, s ? LABEL[s] : 'ล้าง (ยังไม่เช็ค)')), cur.status === s ? h('span', { class: 'hint' }, 'ตอนนี้') : null));
    const sh = sheet({ title: `${st.no ?? ''} ${st.nick || st.firstName}`, sub: `${st.firstName} ${st.lastName}`, body: h('div', {}, h('label', { class: 'field' }, note), ...opts), foot: [h('button', { class: 'btn', onclick: () => sh.close() }, 'ยกเลิก')] });
  }
  function undo() {
    const last = undoStack.pop();
    if (!last) return;
    undoBtn.disabled = !undoStack.length;
    att[last.st.id] = last.prev;
    queue.push({ name: 'setAttendance', args: { sessionId, studentId: last.st.id, status: last.prev.status, note: last.prev.note || '' } });
    paintCard(last.st); paintHead(); queue.flush();
    toast('ย้อนแล้ว');
  }
  // จบรอบแรก: เปลี่ยนหน้าจอทันที แล้วส่งขึ้นระบบเบื้องหลัง (เน็ตหลุดก็เก็บไว้ส่งทีหลัง)
  function endRound1() {
    const setRound = (done) => {
      session = Object.assign({}, session, { onTimeEndAt: done ? now() : null });
      queue.push({ name: 'markOnTimeDone', args: done ? { sessionId } : { sessionId, undo: true } });
      paintHead(); queue.flush();
    };
    setRound(true);
    toast('จบรอบแรกแล้ว — ต่อไปแตะ = สาย 1 / 2', () => setRound(false));
  }
  function periodSheet() {
    const endIn = h('input', { type: 'time', value: fmtClock(endOf(session)) });
    const err = h('div');
    const sh = sheet({
      title: 'เวลาจบคาบนี้', sub: session.planStartAt ? `ตามตาราง เริ่ม ${fmtClock(session.planStartAt)} · ครึ่งคาบคิดจากตาราง` : 'ครึ่งคาบ = กลางระหว่างเวลาที่กดเริ่มกับเวลาจบ',
      body: h('div', {}, h('label', { class: 'field' }, h('span', {}, 'เวลาจบคาบ'), endIn), err),
      foot: [h('button', { class: 'btn', onclick: () => sh.close() }, 'ยกเลิก'), h('button', { class: 'btn pri', onclick: async () => {
        const end = clockToMs(endIn.value, session.startAt);
        if (!end || end <= session.startAt) { err.replaceChildren(errorBox('เวลาจบต้องหลังเวลาเริ่ม')); return; }
        try { const r = await T('setPeriod', { sessionId, planEndAt: end }); session = r.session; paintHead(); tickClock(); sh.close(); }
        catch (e) { err.replaceChildren(errorBox(e)); }
      } }, 'บันทึก')],
    });
  }
  async function closeFlow() {
    const c = countStatuses(students.map((s) => att[s.id] || { status: '' }), students.length);
    const err = h('div');
    const go = h('button', { class: 'btn pri' }, 'ปิดคาบ');
    const sh = sheet({
      title: 'ปิดคาบนี้?', sub: c.none ? `ยังไม่เช็ค ${c.none} คน → จะบันทึกเป็น "ขาด"` : 'เช็คครบทุกคนแล้ว',
      body: h('div', {}, err), foot: [h('button', { class: 'btn', onclick: () => sh.close() }, 'ยังก่อน'), go],
    });
    go.onclick = async () => {
      go.disabled = true;
      await queue.flush();
      if (queue.pending()) { err.replaceChildren(errorBox('ยังมีรายการรอส่ง — ต่ออินเทอร์เน็ตแล้วลองอีกครั้ง')); go.disabled = false; return; }
      try {
        await T('closeSession', { sessionId });
        const fin = await T('sessionState', { sessionId });
        sh.close();
        summary(fin.attendance);
      } catch (e) { err.replaceChildren(errorBox(e)); go.disabled = false; }
    };
  }
  function summary(rows) {
    stop();
    cacheSet('room:' + sectionId, roomInfo({ classroom: sv.classroom, course: sv.course, students: sv.students, session: null }));
    const by = {};
    rows.forEach((r) => { by[r.studentId] = r; });
    const groups = ['P', 'L', 'M', 'S', 'E', 'A'].map((s) => {
      const list = students.filter((st) => { const x = by[st.id]; return x && (x.status === s || (s === 'S' && x.status === 'B')); });
      return h('div', { class: 'sg' },
        h('div', { class: 'sg-t' }, h('span', { class: 'dot', style: `width:10px;height:10px;border-radius:50%;background:${DOT[s]}` }), LABEL[s], h('span', { class: 'n' }, list.length + ' คน')),
        s === 'P' ? null : h('div', { class: 'sg-nos' }, list.map((x) => x.no).join(' ') || '–'),
        s === 'P' ? null : h('div', { class: 'sg-who' }, list.map((x) => `${x.no} ${x.nick || x.firstName}${by[x.id].note ? ' (' + by[x.id].note + ')' : ''}`).join(' · ')));
    });
    const halfList = students.filter((st) => by[st.id] && /เกินครึ่งคาบ/.test(by[st.id].note || ''));
    app.replaceChildren(header({ title: 'สรุปคาบ', sub: `${sv.classroom.name} · ${sv.course.name}`, back: '#/t' }),
      h('div', { class: 'body' }, h('div', { class: 'sum' }, groups,
        halfList.length ? h('div', { class: 'sg' }, h('div', { class: 'sg-t' }, '⏱ มาเกินครึ่งคาบ', h('span', { class: 'n' }, halfList.length + ' คน')), h('div', { class: 'sg-who' }, halfList.map((x) => `${x.no} ${x.nick || x.firstName}`).join(' · '))) : null),
      h('div', { class: 'pad' }, h('button', { class: 'btn pri big', onclick: () => { location.hash = '#/t'; } }, 'กลับหน้าห้อง'))));
  }

  // ---------- จังหวะเวลา ----------
  const t1 = setInterval(() => queue.flush(), 5000);
  const t2 = setInterval(paintHead, 15000);
  const t3 = setInterval(tickClock, 1000);
  tickClock();
  const onOnline = () => queue.flush();
  window.addEventListener('online', onOnline);
  function stop() { clearInterval(t1); clearInterval(t2); clearInterval(t3); window.removeEventListener('online', onOnline); }
  queue.flush();
  return stop;
}
