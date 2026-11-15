// ครู: ตั้งค่า (เวลาคาบ · วิชา · นำเข้ารายชื่อ · รีเซ็ต PIN)
import { T, store } from '../api.js';
import { h, sheet, toast, header, errorBox } from '../ui.js';

export async function render(app) {
  const body = h('div', { class: 'body pad' });
  app.append(header({ title: 'ตั้งค่า', back: '#/t' }), body);
  let home, periods;
  try { [home, periods] = await Promise.all([T('tHome', {}), T('getPeriods', {})]); } catch (e) { body.append(errorBox(e)); return; }
  const courses = home.courses.filter((c) => !home.activeTermId || c.termId === home.activeTermId);
  body.append(periodCard(periods), courseCard(home, courses), importCard(courses), pinCard(home),
    h('button', { class: 'btn big', style: 'margin-top:6px', onclick: () => { store.set('tTok', null); location.hash = '#/t'; window.dispatchEvent(new HashChangeEvent('hashchange')); } }, 'ออกจากระบบครู'));
}

function periodCard(p) {
  const normal = (p.normal || []).map((x) => ({ ...x }));
  const special = (p.special || []).map((x) => ({ ...x }));
  const nBox = h('div'), sBox = h('div'), err = h('div');
  const num = (o, k, w) => h('input', { type: 'number', value: o[k] ?? '', style: `width:${w}px`, oninput: (e) => { o[k] = Number(e.target.value) || null; } });
  const paintN = () => nBox.replaceChildren(...normal.map((x, i) => h('div', { class: 'hrow', style: 'margin-bottom:6px' },
    h('span', { class: 'hint', style: 'width:44px' }, 'คาบ ' + (i + 1)),
    h('input', { type: 'time', value: x.start || '', oninput: (e) => { x.start = e.target.value; } }), num(x, 'minutes', 64), h('span', { class: 'hint' }, 'นาที'),
    h('button', { class: 'chip', onclick: () => { normal.splice(i, 1); paintN(); } }, '×'))));
  const paintS = () => sBox.replaceChildren(...special.map((x, i) => h('div', { class: 's-card', style: 'background:#f6f7f9;box-shadow:none' },
    h('label', { class: 'field' }, h('span', {}, 'ชื่อช่วง'), h('input', { value: x.name || '', placeholder: 'เช่น กีฬาสี', oninput: (e) => { x.name = e.target.value; } })),
    h('div', { class: 'hrow' }, h('input', { type: 'date', value: x.from || '', oninput: (e) => { x.from = e.target.value; } }), '–', h('input', { type: 'date', value: x.to || '', oninput: (e) => { x.to = e.target.value; } })),
    h('div', { class: 'hrow', style: 'margin-top:6px' }, h('span', { class: 'hint' }, 'คาบละ'), num(x, 'minutes', 64), h('span', { class: 'hint' }, 'นาที'), h('span', { class: 'spacer' }),
      h('button', { class: 'chip', onclick: () => { special.splice(i, 1); paintS(); } }, 'ลบช่วงนี้')))));
  paintN(); paintS();
  return h('div', { class: 's-card' }, h('h4', {}, 'เวลาคาบ (ไม่บังคับ)'),
    h('p', { class: 'hint' }, 'ใช้เสนอเวลาเริ่มตอนกด "เริ่มคาบ" · ไม่ตั้งก็ได้ ระบบใช้เวลาที่กดแทน'),
    h('div', { class: 'sec-t' }, 'เวลาคาบปกติ'), nBox,
    h('button', { class: 'chip', onclick: () => { const last = normal[normal.length - 1]; normal.push({ no: normal.length + 1, start: '', minutes: last ? last.minutes : 50 }); paintN(); } }, '+ เพิ่มคาบ'),
    h('div', { class: 'sec-t' }, 'ช่วงเวลาพิเศษ (เช่น กีฬาสี)'), sBox,
    h('button', { class: 'chip', onclick: () => { special.push({ name: '', from: '', to: '', minutes: 40 }); paintS(); } }, '+ เพิ่มช่วงพิเศษ'), err,
    h('button', { class: 'btn pri big', style: 'margin-top:10px', onclick: async () => {
      try {
        await T('savePeriods', { normal: normal.filter((x) => x.start).map((x, i) => ({ no: i + 1, start: x.start, minutes: x.minutes || 50 })), special: special.filter((x) => x.from && x.to) });
        err.replaceChildren(); toast('บันทึกเวลาคาบแล้ว');
      } catch (e) { err.replaceChildren(errorBox(e)); }
    } }, 'บันทึกเวลาคาบ'));
}

function courseCard(home, courses) {
  const name = h('input', { placeholder: 'ชื่อวิชาใหม่ เช่น สุขศึกษา' });
  const err = h('div');
  return h('div', { class: 's-card' }, h('h4', {}, 'วิชาเทอมนี้'),
    ...courses.map((c) => h('div', { class: 'lrow' }, h('span', { class: 'who' }, h('b', {}, c.name),
      h('small', {}, home.sections.filter((s) => s.courseId === c.id).map((s) => (home.classrooms.find((r) => r.id === s.classroomId) || {}).name).filter(Boolean).sort((a, b) => a.localeCompare(b, 'th', { numeric: true })).join(' · ') || 'ยังไม่มีห้อง')))),
    h('div', { class: 'hrow', style: 'margin-top:10px' }, name, h('button', { class: 'btn pri', onclick: async () => {
      if (!name.value.trim()) return;
      try {
        let termId = home.activeTermId;
        if (!termId) termId = (await T('saveTerm', { name: '2/2569', active: true })).id;
        await T('saveCourse', { termId, name: name.value.trim() });
        location.reload();
      } catch (e) { err.replaceChildren(errorBox(e)); }
    } }, 'เพิ่ม')), err);
}

function importCard(courses) {
  const sel = h('select', {}, ...courses.map((c) => h('option', { value: c.id }, c.name)));
  const text = h('textarea', { rows: 5, placeholder: 'วางรายชื่อ: ห้อง | เลขที่ | รหัสนักเรียน | คำนำหน้า | ชื่อ | นามสกุล (แยกด้วย Tab)\nเช่น ม.2/3\t1\t17001\tเด็กชาย\tก้อง\tใจดี' });
  const out = h('div');
  return h('div', { class: 's-card' }, h('h4', {}, 'นำเข้ารายชื่อ'),
    h('p', { class: 'hint' }, 'คัดลอกจาก Excel หรือไฟล์ที่ได้จาก tools/roster_to_tsv.py · ห้ามใส่เลขประจำตัวประชาชน · ห้องที่ยังไม่มีจะสร้างให้และผูกกับวิชาที่เลือก'),
    h('label', { class: 'field' }, h('span', {}, 'ผูกกับวิชา'), sel), h('label', { class: 'field' }, text), out,
    h('button', { class: 'btn pri big', onclick: async () => {
      if (/\d{13}/.test(text.value)) { out.replaceChildren(errorBox('พบตัวเลข 13 หลัก (เลขประชาชน?) — ลบคอลัมน์นั้นออกก่อน')); return; }
      try {
        const r = await T('importAll', { text: text.value, courseId: sel.value });
        out.replaceChildren(h('div', { class: 'banner' }, `เพิ่ม ${r.added} คน · อัปเดต ${r.updated} · ข้าม ${r.skipped} · ${r.rooms} ห้อง (ห้องใหม่ ${r.newRooms}) · ผูกวิชา ${r.linked} ห้อง`));
        text.value = '';
      } catch (e) { out.replaceChildren(errorBox(e)); }
    } }, 'นำเข้า'));
}

function pinCard(home) {
  const sel = h('select', {}, h('option', { value: '' }, 'เลือกห้อง'), ...home.classrooms.map((r) => h('option', { value: r.id }, r.name)));
  const list = h('div');
  sel.onchange = async () => {
    list.replaceChildren();
    if (!sel.value) return;
    const v = await T('classroomView', { classroomId: sel.value });
    list.replaceChildren(...v.students.filter((s) => s.hasPin).map((s) => h('button', { class: 'lrow', onclick: () => {
      const sh = sheet({ title: `รีเซ็ต PIN ${s.no ?? ''} ${s.firstName}?`, sub: 'นักเรียนต้องสแกน QR ห้องแล้วตั้ง PIN ใหม่', body: h('div'),
        foot: [h('button', { class: 'btn', onclick: () => sh.close() }, 'ยกเลิก'), h('button', { class: 'btn pri', onclick: async () => { await T('resetPin', { studentId: s.id }); sh.close(); toast('รีเซ็ตแล้ว'); sel.onchange(); } }, 'รีเซ็ต')] });
    } }, h('span', { class: 'no' }, s.no ?? ''), h('span', { class: 'who' }, h('b', {}, `${s.firstName} ${s.lastName}`), h('small', {}, s.nick || '')), h('span', { class: 'hint' }, 'รีเซ็ต ›'))));
    if (!list.children.length) list.append(h('div', { class: 'empty' }, 'ยังไม่มีใครตั้ง PIN'));
  };
  return h('div', { class: 's-card' }, h('h4', {}, 'รีเซ็ต PIN นักเรียน'), h('label', { class: 'field' }, sel), list);
}
