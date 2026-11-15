// นักเรียน: สแกน QR ห้อง → แตะชื่อ → ตั้ง/ใส่ PIN
import { call, store } from '../api.js';
import { h, sheet, errorBox } from '../ui.js';
import { matchStudent } from '../teacher/checkin-state.js';

export async function render(app, { classroomId }) {
  let d;
  try { d = await call('classroomPublic', { classroomId }); } catch (e) { app.append(h('div', { class: 'loading' }, 'ไม่พบห้องนี้ — ขอ QR ใหม่จากครู')); return; }
  store.set('sClass', classroomId);
  const q = h('input', { placeholder: 'ค้นเลขที่หรือชื่อ', oninput: paint });
  const list = h('div', { class: 's-card' });
  app.append(h('div', { class: 's-hd' }, h('small', {}, 'ระบบวิชาเรียน'), h('b', {}, `ห้อง ${d.classroom.name} · แตะชื่อของตัวเอง`)),
    h('div', { class: 's-body' }, h('div', { class: 's-card' }, h('label', { class: 'field', style: 'margin:0' }, q)), list));
  function paint() {
    const rows = d.students.filter((s) => matchStudent(s, q.value));
    list.replaceChildren(...rows.map((s) => h('button', { class: 'lrow', onclick: () => pinSheet(s) },
      h('span', { class: 'no' }, s.no ?? ''), h('span', { class: 'who' }, h('b', {}, `${s.firstName} ${s.lastName}`), s.nick ? h('small', {}, s.nick) : null),
      h('span', { class: 'hint' }, s.hasPin ? 'ใส่ PIN ›' : 'ตั้ง PIN ›'))));
    if (!rows.length) list.append(h('div', { class: 'empty' }, 'ไม่พบชื่อ'));
  }
  paint();

  function pinSheet(s) {
    const first = !s.hasPin;
    const pinIn = (ph) => h('input', { type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: 4, autocomplete: 'off', placeholder: ph, style: 'text-align:center;font-size:24px;letter-spacing:10px' });
    const pin1 = pinIn('••••'), pin2 = first ? pinIn('••••') : null;
    const nick = first ? h('input', { placeholder: 'ชื่อเล่น', value: s.nick || '', maxlength: 20 }) : null;
    const err = h('div');
    const go = h('button', { class: 'btn pri' }, first ? 'ตั้ง PIN' : 'เข้าระบบ');
    const sh = sheet({
      title: `${s.no ?? ''} ${s.firstName} ${s.lastName}`, sub: first ? 'ครั้งแรก: ตั้ง PIN 4 หลัก จำไว้ใช้ครั้งต่อไป' : 'ใส่ PIN 4 หลักของตัวเอง',
      body: h('div', {},
        first ? h('label', { class: 'field' }, h('span', {}, 'ชื่อเล่น'), nick) : null,
        h('label', { class: 'field' }, h('span', {}, first ? 'PIN ใหม่' : 'PIN'), pin1),
        first ? h('label', { class: 'field' }, h('span', {}, 'ใส่ PIN อีกครั้ง'), pin2) : null,
        h('div', { class: 'hint' }, 'ลืม PIN ให้บอกครูรีเซ็ต · ห้ามบอก PIN ให้เพื่อน'), err),
      foot: [h('button', { class: 'btn', onclick: () => sh.close() }, 'ไม่ใช่ฉัน'), go],
    });
    setTimeout(() => (nick || pin1).focus(), 250);
    go.onclick = async () => {
      err.replaceChildren();
      if (!/^\d{4}$/.test(pin1.value)) { err.replaceChildren(errorBox('PIN ต้องเป็นตัวเลข 4 หลัก')); return; }
      if (first && pin1.value !== pin2.value) { err.replaceChildren(errorBox('PIN สองช่องไม่ตรงกัน')); return; }
      go.disabled = true;
      try {
        const r = await call('studentLogin', { studentId: s.id, pin: pin1.value, nick: nick ? nick.value.trim() : '' });
        store.set('sTok', r.token);
        store.set('sName', `${r.student.no ?? ''} ${r.student.nick || r.student.firstName} · ${d.classroom.name}`);
        sh.close();
        location.hash = '#/s';
      } catch (e) { err.replaceChildren(errorBox(e)); go.disabled = false; }
    };
  }
}
