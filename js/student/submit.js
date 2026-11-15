// นักเรียน: ส่งงานรูป (ย่อในเครื่อง → ส่ง · ส่งซ้ำได้ด้วยรหัสการส่งเดิม)
import { S, store } from '../api.js';
import { h, header, errorBox, fmtDate, toast } from '../ui.js';
import { toJpegBase64 } from '../image.js';
import { dueText } from './home.js';

const MAX = 5;

export async function render(app, { assignmentId }) {
  if (!store.get('sTok')) { location.hash = '#/s'; return; }
  let a;
  try { a = (await S('myAssignments', {})).find((x) => x.id === assignmentId); } catch (e) { app.append(errorBox(e)); return; }
  if (!a) { app.append(header({ title: 'ไม่พบงาน', back: '#/s' })); return; }

  const picks = []; // {file, url, enc?}
  const input = h('input', { type: 'file', accept: 'image/*', multiple: true, style: 'display:none', onchange: () => { add([...input.files]); input.value = ''; } });
  const thumbs = h('div', { class: 'thumbs' });
  const bar = h('div', { class: 'bar', style: 'display:none' }, h('i'));
  const msg = h('div');
  const send = h('button', { class: 'btn pri big', disabled: true, onclick: doSend }, a.status === 'missing' ? 'ส่งงาน' : 'ส่งฉบับใหม่');
  const d = dueText(a.dueAt);
  app.append(header({ title: a.title, sub: a.courseName, back: '#/s' }),
    h('div', { class: 'body pad' },
      h('div', { class: 's-card' },
        h('div', { class: 'due' + (d.today ? ' today' : '') }, d.text),
        a.status !== 'missing' ? h('div', { class: 'banner', style: 'margin:8px 0 0' }, `ส่งแล้วเมื่อ ${fmtDate(a.submittedAt)} — ส่งใหม่จะแทนฉบับเดิม (ส่งได้จนกว่าครูจะตรวจ)`) : null),
      h('div', { class: 's-card' }, h('h4', {}, `รูปงาน (สูงสุด ${MAX} รูป)`), thumbs, bar, msg, send), input));
  paint();

  function add(files) {
    for (const f of files) { if (picks.length >= MAX) { toast(`ส่งได้ไม่เกิน ${MAX} รูป`); break; } picks.push({ file: f, url: URL.createObjectURL(f) }); }
    sessionStorage.removeItem('cid:' + assignmentId); // ชุดรูปเปลี่ยน = การส่งครั้งใหม่
    paint();
  }
  function paint() {
    thumbs.replaceChildren(...picks.map((p, i) => h('div', { class: 'thumb' }, h('img', { src: p.url, alt: '' }),
      h('button', { 'aria-label': 'ลบรูป', onclick: () => { URL.revokeObjectURL(p.url); picks.splice(i, 1); sessionStorage.removeItem('cid:' + assignmentId); paint(); } }, '×'))));
    if (picks.length < MAX) thumbs.append(h('button', { class: 'addpic', onclick: () => input.click() }, h('span', { class: 'i' }, '📷'), 'ถ่าย / เลือกรูป'));
    send.disabled = !picks.length;
  }
  function progress(p) { bar.style.display = ''; bar.firstChild.style.width = Math.round(p * 100) + '%'; }

  async function doSend() {
    send.disabled = true; msg.replaceChildren();
    try {
      for (let i = 0; i < picks.length; i++) {
        if (!picks[i].enc) picks[i].enc = await toJpegBase64(picks[i].file);
        progress(0.1 + 0.4 * (i + 1) / picks.length);
      }
      let cid = sessionStorage.getItem('cid:' + assignmentId);
      if (!cid) { cid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); sessionStorage.setItem('cid:' + assignmentId, cid); }
      progress(0.6);
      const tick = setInterval(() => { const w = parseFloat(bar.firstChild.style.width) || 60; if (w < 95) progress((w + 3) / 100); }, 600);
      let r;
      try { r = await S('submitWork', { assignmentId, clientId: cid, files: picks.map((p) => p.enc) }); } finally { clearInterval(tick); }
      progress(1);
      sessionStorage.removeItem('cid:' + assignmentId);
      app.replaceChildren(header({ title: a.title, sub: a.courseName, back: '#/s' }),
        h('div', { class: 'body pad' }, h('div', { class: 's-card', style: 'text-align:center' },
          h('div', { style: 'font-size:46px' }, '✅'), h('h4', { style: 'font-size:18px' }, r.late ? 'ส่งแล้ว (ส่งช้า)' : 'ส่งงานเรียบร้อย'),
          h('p', { class: 'hint' }, `${fmtDate(r.submittedAt)}${r.version > 1 ? ` · ฉบับที่ ${r.version}` : ''} · ${picks.length} รูป`),
          h('button', { class: 'btn pri big', onclick: () => { location.hash = '#/s'; } }, 'กลับหน้างานของฉัน'))));
    } catch (e) {
      msg.replaceChildren(errorBox(e.network ? 'ส่งไม่สำเร็จ (เน็ตหลุด) — กด "ลองส่งอีกครั้ง" ได้เลย รูปไม่หาย' : e));
      send.textContent = 'ลองส่งอีกครั้ง';
      send.disabled = false;
    }
  }
}
