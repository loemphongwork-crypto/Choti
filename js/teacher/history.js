// ครู: แก้เช็คชื่อย้อนหลัง (ค้นชื่อ → เลือกคาบ → เปลี่ยนสถานะ)
import { T, cacheGet, cacheSet } from '../api.js';
import { roomInfo } from './room-info.js';
import { h, sheet, toast, header, errorBox, fmtDate } from '../ui.js';
import { LABEL, matchStudent } from './checkin-state.js';

const TAG = { P: 't-ok', L: 't-l1', M: 't-l2', S: 't-lv', B: 't-lv', E: 't-act', A: 't-abs', '': 't-none' };

export async function render(app, { sectionId }) {
  let sv = cacheGet('room:' + sectionId);
  const fresh = T('checkinView', { sectionId }).then((d) => { const r = roomInfo(d); cacheSet('room:' + sectionId, r); return r; });
  if (!sv) { try { sv = await fresh; } catch (e) { app.append(errorBox(e)); return; } }
  fresh.catch(() => {});
  const q = h('input', { placeholder: 'พิมพ์เลขที่ หรือชื่อ', oninput: paint });
  const list = h('div', { class: 's-card' });
  app.append(header({ title: 'แก้เช็คชื่อย้อนหลัง', sub: `${sv.classroom.name} · ${sv.course.name}`, back: '#/t' }),
    h('div', { class: 'body pad' }, h('label', { class: 'field' }, q), list));
  function paint() {
    const rows = sv.students.filter((s) => matchStudent(s, q.value));
    list.replaceChildren(...rows.map((st) => h('button', { class: 'lrow', onclick: () => openStudent(st) },
      h('span', { class: 'no' }, st.no ?? ''), h('span', { class: 'who' }, h('b', {}, st.nick || st.firstName), h('small', {}, `${st.firstName} ${st.lastName}`)), h('span', { class: 'hint' }, '›'))));
    if (!rows.length) list.append(h('div', { class: 'empty' }, 'ไม่พบชื่อ'));
  }
  paint();
  q.focus();
  fresh.then((r) => { sv = r; paint(); }).catch(() => {});

  async function openStudent(st) {
    const box = h('div', {}, h('div', { class: 'loading' }, 'กำลังโหลด…'));
    const sh = sheet({ title: `${st.no ?? ''} ${st.nick || st.firstName}`, sub: 'แตะคาบที่ต้องการแก้', body: box, foot: [h('button', { class: 'btn', onclick: () => sh.close() }, 'ปิด')] });
    let rows;
    try { rows = await T('studentAttendance', { sectionId, studentId: st.id }); } catch (e) { box.replaceChildren(errorBox(e)); return; }
    box.replaceChildren(...(rows.length ? rows.map((r) => h('button', { class: 'lrow', onclick: () => { sh.close(); editOne(st, r); } },
      h('span', { class: 'who' }, h('b', {}, fmtDate(r.startAt)), r.note ? h('small', {}, r.note) : null),
      h('span', { class: 'tag ' + TAG[r.status] }, LABEL[r.status] || '–'))) : [h('div', { class: 'empty' }, 'ยังไม่มีคาบที่ปิดแล้ว')]));
  }

  function editOne(st, r) {
    const note = h('input', { placeholder: 'หมายเหตุ (ไม่บังคับ)', value: r.note || '' });
    const err = h('div');
    const sh = sheet({
      title: `${st.nick || st.firstName} · ${fmtDate(r.startAt, false)}`, sub: 'เลือกสถานะใหม่',
      body: h('div', {}, h('label', { class: 'field' }, note), err, ...['P', 'L', 'M', 'S', 'E', 'A'].map((s) => h('button', { class: 'opt', onclick: async () => {
        try {
          await T('setAttendance', { sessionId: r.sessionId, studentId: st.id, status: s, note: note.value.trim(), time: r.startAt });
          sh.close(); toast(`แก้เป็น "${LABEL[s]}" แล้ว`);
        } catch (e) { err.replaceChildren(errorBox(e)); }
      } }, h('span', { class: 't' }, h('b', {}, LABEL[s])), (r.status === s || (s === 'S' && r.status === 'B')) ? h('span', { class: 'hint' }, 'ตอนนี้') : null))),
      foot: [h('button', { class: 'btn', onclick: () => sh.close() }, 'ยกเลิก')],
    });
  }
}
