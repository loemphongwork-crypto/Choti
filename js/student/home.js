// นักเรียน: หน้าแรก = งานของฉัน
import { S, store } from '../api.js';
import { h, errorBox, fmtDate, bkkDay } from '../ui.js';

const TAG = { sent: ['t-ok', 'ส่งแล้ว'], late: ['t-l1', 'ส่งช้า'], missing: ['t-none', 'ยังไม่ส่ง'] };

export function dueText(dueAt, now = Date.now()) {
  if (bkkDay(dueAt) === bkkDay(now)) return { text: `ส่งวันนี้ ก่อน ${fmtDate(dueAt).slice(-5)} น.`, today: true };
  if (dueAt < now) return { text: `เลยกำหนด (${fmtDate(dueAt)}) — ยังส่งได้`, today: true };
  return { text: `ส่งภายใน ${fmtDate(dueAt)} น.`, today: false };
}

export async function render(app) {
  if (!store.get('sTok')) {
    const cls = store.get('sClass');
    app.append(h('div', { class: 's-hd' }, h('small', {}, 'ระบบวิชาเรียน'), h('b', {}, 'สำหรับนักเรียน')),
      h('div', { class: 's-body' }, h('div', { class: 's-card' }, h('h4', {}, 'เข้าระบบ'),
        h('p', { class: 'hint' }, 'สแกน QR ห้องจากครู แล้วแตะชื่อของตัวเอง'),
        cls ? h('button', { class: 'btn pri big', onclick: () => { location.hash = '#/join/' + cls; } }, 'เข้าระบบห้องเดิม') : null)));
    return;
  }
  const list = h('div', {}, h('div', { class: 'loading' }, 'กำลังโหลดงาน…'));
  const body = h('div', { class: 's-body' });
  app.append(h('div', { class: 's-hd' }, h('small', {}, 'งานของฉัน'), h('b', {}, store.get('sName') || '')), body);

  if (!store.get('a2hsDone')) {
    const ban = h('div', { class: 'banner' }, h('span', {}, '📌 กด ⋮ หรือ ⎙ แล้วเลือก "เพิ่มไปยังหน้าจอหลัก" จะเปิดแอปได้ทันทีครั้งต่อไป'),
      h('button', { onclick: () => { store.set('a2hsDone', '1'); ban.remove(); } }, 'ปิด'));
    body.append(ban);
  }
  body.append(list, h('div', { style: 'text-align:center;margin-top:14px' },
    h('button', { class: 'hint', style: 'text-decoration:underline', onclick: () => { store.set('sTok', null); const c = store.get('sClass'); location.hash = c ? '#/join/' + c : '#/s'; } }, 'ไม่ใช่ฉัน / ออกจากระบบ')));

  let rows;
  try { rows = await S('myAssignments', {}); } catch (e) {
    if (e.message === 'AUTH') { location.hash = store.get('sClass') ? '#/join/' + store.get('sClass') : '#/s'; return; }
    list.replaceChildren(errorBox(e)); return;
  }
  if (!rows.length) { list.replaceChildren(h('div', { class: 's-card empty' }, 'ยังไม่มีงานที่ครูสั่ง')); return; }
  const open = rows.filter((r) => r.status === 'missing');
  const done = rows.filter((r) => r.status !== 'missing').sort((a, b) => b.dueAt - a.dueAt);
  const card = (r) => {
    const d = dueText(r.dueAt);
    const [cls, lbl] = TAG[r.status];
    return h('button', { class: 's-card work', onclick: () => { location.hash = '#/s/a/' + r.id; } },
      h('div', { class: 'hrow' }, h('div', { class: 'cls' }, h('b', {}, r.title), h('small', {}, r.courseName)), h('span', { class: 'tag ' + cls }, lbl)),
      r.status === 'missing' ? h('div', { class: 'due' + (d.today ? ' today' : '') }, d.text) : h('div', { class: 'due' }, `ส่งเมื่อ ${fmtDate(r.submittedAt)}${r.version > 1 ? ` · ฉบับที่ ${r.version}` : ''}`));
  };
  list.replaceChildren(...[
    open.length ? h('div', { class: 'sec-t' }, `ต้องส่ง ${open.length} งาน`) : null, ...open.map(card),
    done.length ? h('div', { class: 'sec-t' }, 'ส่งแล้ว') : null, ...done.map(card)].filter(Boolean));
}
