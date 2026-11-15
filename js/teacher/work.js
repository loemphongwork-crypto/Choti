// ครู: งานของห้อง (สั่งงาน + ดูการส่ง)
import { T } from '../api.js';
import { h, sheet, toast, header, errorBox, fmtDate } from '../ui.js';
import { clockToMs } from '../period.js';

export async function render(app, params, view) {
  if (view === 'assignment') return renderAssignment(app, params.assignmentId);
  return renderSection(app, params.sectionId);
}

async function renderSection(app, sectionId) {
  const list = h('div', {}, h('div', { class: 'loading' }, 'กำลังโหลด…'));
  let sv;
  try { sv = await T('sectionView', { sectionId }); } catch (e) { app.append(errorBox(e)); return; }
  app.append(header({
    title: `งาน · ${sv.classroom.name}`, sub: sv.course.name, back: '#/t',
    right: h('button', { class: 'pill', style: 'background:#f1f2f5', onclick: async () => (await import('./qr.js')).showRoomQR(sv.classroom) }, '▣ QR ห้อง'),
  }), h('div', { class: 'body pad' }, h('button', { class: 'btn pri big', onclick: () => newSheet(sectionId, load) }, '+ สั่งงาน'), h('div', { style: 'height:10px' }), list));
  async function load() {
    try {
      const rows = await T('sectionAssignments', { sectionId });
      list.replaceChildren(...(rows.length ? rows.map((a) => h('button', { class: 'room', onclick: () => { location.hash = '#/t/w/a/' + a.id; } },
        h('div', { class: 'grow' }, h('b', { style: 'font-size:16px' }, a.title), h('small', {}, `ส่งภายใน ${fmtDate(a.dueAt)}`)),
        h('span', { class: 'tag ' + (a.sent >= a.total ? 't-ok' : 't-none') }, `ส่ง ${a.sent}/${a.total}`),
        a.late ? h('span', { class: 'tag t-l1' }, `ช้า ${a.late}`) : null)) : [h('div', { class: 'empty' }, 'ยังไม่มีงาน — กด "+ สั่งงาน"')]));
    } catch (e) { list.replaceChildren(errorBox(e)); }
  }
  load();
}

function newSheet(sectionId, onDone) {
  let days = 0;
  const title = h('input', { placeholder: 'เช่น ใบงานที่ 1 จังหวะตัวโน้ต', maxlength: 80 });
  const time = h('input', { type: 'time', value: '23:59' });
  const score = h('input', { type: 'number', min: 0, max: 100, inputmode: 'numeric', placeholder: 'ไม่บังคับ' });
  const daysIn = h('input', { type: 'number', min: 0, max: 31, inputmode: 'numeric', placeholder: 'อื่น ๆ', style: 'width:84px' });
  const chips = h('div', { class: 'chips' });
  const dueShow = h('div', { class: 'hint', style: 'margin-top:6px' });
  const tplBox = h('div');
  const err = h('div');
  const paint = () => {
    chips.replaceChildren(...[[0, 'วันนี้'], [1, 'พรุ่งนี้'], [3, '3 วัน'], [7, '7 วัน']].map(([d, l]) => h('button', { class: 'chip' + (d === days ? ' sel' : ''), onclick: () => { days = d; daysIn.value = ''; paint(); } }, l)), daysIn);
    const due = clockToMs(time.value || '23:59', Date.now() + days * 86400000);
    dueShow.textContent = due ? `ปิดรับ ${fmtDate(due)} น. · เลยกำหนดยังส่งได้ (ป้าย "ส่งช้า")` : '';
  };
  daysIn.oninput = () => { const v = Number(daysIn.value); if (daysIn.value !== '' && v >= 0 && v <= 31) { days = v; chips.querySelectorAll('.chip').forEach((c) => c.classList.remove('sel')); paint(); daysIn.focus(); } };
  time.oninput = paint;
  paint();
  const go = h('button', { class: 'btn pri' }, 'สั่งงาน');
  const sh = sheet({
    title: 'สั่งงาน', sub: 'งานเดี่ยว · ส่งเป็นรูป',
    body: h('div', {},
      h('button', { class: 'btn', style: 'width:100%;margin-bottom:10px', onclick: showTemplates }, '↻ ใช้งานที่เคยสั่ง (ห้องอื่น)'), tplBox,
      h('label', { class: 'field' }, h('span', {}, 'ชื่องาน'), title),
      h('div', { class: 'field' }, h('span', {}, 'กำหนดส่ง'), chips, dueShow),
      h('label', { class: 'field' }, h('span', {}, 'เวลาปิดรับ'), time),
      h('label', { class: 'field' }, h('span', {}, 'คะแนนเต็ม'), score), err),
    foot: [h('button', { class: 'btn', onclick: () => sh.close() }, 'ยกเลิก'), go],
  });
  async function showTemplates() {
    tplBox.replaceChildren(h('div', { class: 'loading', style: 'padding:8px' }, 'กำลังโหลด…'));
    try {
      const tpl = await T('assignmentTemplates', { sectionId });
      tplBox.replaceChildren(...(tpl.length ? tpl.slice(0, 8).map((t) => h('button', { class: 'opt', onclick: () => {
        title.value = t.title; days = Math.min(31, Math.max(0, t.dueDays || 0)); score.value = t.maxScore || ''; tplBox.replaceChildren(); paint();
      } }, h('span', { class: 't' }, h('b', {}, t.title), h('small', {}, `กำหนดส่ง ${t.dueDays} วัน${t.maxScore ? ' · เต็ม ' + t.maxScore : ''}`)))) : [h('div', { class: 'hint', style: 'margin-bottom:10px' }, 'ยังไม่มีงานที่สั่งในห้องอื่นของวิชานี้')]));
    } catch (e) { tplBox.replaceChildren(errorBox(e)); }
  }
  go.onclick = async () => {
    if (!title.value.trim()) { err.replaceChildren(errorBox('ใส่ชื่องาน')); return; }
    go.disabled = true;
    try {
      await T('saveAssignment', { sectionId, title: title.value.trim(), dueDays: days, dueTime: time.value || '23:59', maxScore: score.value || undefined });
      sh.close(); toast('สั่งงานแล้ว'); onDone();
    } catch (e) { err.replaceChildren(errorBox(e)); go.disabled = false; }
  };
  setTimeout(() => title.focus(), 250);
}

async function renderAssignment(app, assignmentId) {
  let v;
  try { v = await T('assignmentView', { assignmentId }); } catch (e) { app.append(errorBox(e)); return; }
  const a = v.assignment;
  let tab = 'missing';
  const groups = {
    sent: v.students.filter((s) => s.status !== 'missing'),
    missing: v.students.filter((s) => s.status === 'missing'),
    late: v.students.filter((s) => s.status === 'late'),
  };
  const tabs = h('div', { class: 'tabs' });
  const list = h('div', { class: 's-card' });
  app.append(header({ title: a.title, sub: `ปิดรับ ${fmtDate(a.dueAt)} น.`, back: '#/t/w/' + a.sectionId }),
    h('div', { class: 'body pad' }, tabs, h('div', { style: 'height:10px' }), list));
  function paint() {
    tabs.replaceChildren(...[['missing', 'ค้าง'], ['sent', 'ส่งแล้ว'], ['late', 'ส่งช้า']].map(([k, l]) => h('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; paint(); } }, `${l} ${groups[k].length}`)));
    const rows = groups[tab];
    list.replaceChildren(...(rows.length ? rows.map((r) => h('div', { class: 'lrow' },
      h('span', { class: 'no' }, r.student.no ?? ''),
      h('span', { class: 'who' }, h('b', {}, r.student.nick || r.student.firstName), h('small', {}, r.submittedAt ? `${fmtDate(r.submittedAt)}${r.version > 1 ? ` · ฉบับที่ ${r.version}` : ''}` : `${r.student.firstName} ${r.student.lastName}`)),
      ...r.fileUrls.map((u, i) => h('a', { class: 'tag t-ok', href: u, target: '_blank', rel: 'noopener' }, 'รูป ' + (i + 1))),
      r.status === 'late' ? h('span', { class: 'tag t-l1' }, 'ช้า') : null)) : [h('div', { class: 'empty' }, tab === 'missing' ? 'ส่งครบทุกคนแล้ว 🎉' : 'ยังไม่มี')]));
  }
  paint();
}
