// ชิ้นส่วนหน้าจอที่ใช้ร่วมกัน
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}

export const $app = () => document.getElementById('app');

let toastTimer;
export function toast(msg, undo) {
  const app = $app();
  let t = app.querySelector('.toast');
  if (!t) { t = h('div', { class: 'toast' }, h('span'), h('button')); app.append(t); }
  t.querySelector('span').textContent = msg;
  const b = t.querySelector('button');
  b.style.display = undo ? '' : 'none';
  b.textContent = '↶ ย้อน';
  b.onclick = () => { t.classList.remove('on'); undo && undo(); };
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), undo ? 5000 : 3000);
}

/** แผ่นเลื่อนขึ้น: sheet({title, sub, body: Node, foot: Node[]}) → {close} */
export function sheet({ title, sub, body, foot }) {
  const app = $app();
  const scrim = h('div', { class: 'scrim' });
  const sh = h('div', { class: 'sheet' },
    h('div', { class: 'sh-h' }, h('div', { class: 'grab' }), title && h('b', {}, title), sub && h('small', {}, sub)),
    h('div', { class: 'sh-b' }, body),
    foot && foot.length ? h('div', { class: 'sh-f' }, foot) : null);
  const close = () => { scrim.classList.remove('on'); sh.classList.remove('on'); setTimeout(() => { scrim.remove(); sh.remove(); }, 250); };
  scrim.onclick = close;
  app.append(scrim, sh);
  requestAnimationFrame(() => { scrim.classList.add('on'); sh.classList.add('on'); });
  return { close, el: sh };
}

/** แตะ = onTap · กดค้าง 500ms = onHold */
export function press(el, onTap, onHold) {
  let timer = null, held = false, sx = 0, sy = 0;
  el.addEventListener('pointerdown', (e) => {
    held = false; sx = e.clientX; sy = e.clientY;
    el.classList.add('pressing');
    timer = setTimeout(() => { held = true; el.classList.remove('pressing'); if (navigator.vibrate) navigator.vibrate(20); onHold && onHold(); }, 500);
  });
  const cancel = () => { clearTimeout(timer); el.classList.remove('pressing'); };
  el.addEventListener('pointermove', (e) => { if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) cancel(); });
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointerup', () => { const wasTimer = el.classList.contains('pressing'); cancel(); if (!held && wasTimer) onTap && onTap(); });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

const TH_DAY = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
/** วันเวลาไทย เช่น "อ. 17 พ.ย. 23:59" */
export function fmtDate(ms, withTime = true) {
  const d = new Date(ms + 7 * 3600000);
  const s = `${TH_DAY[d.getUTCDay()]} ${d.getUTCDate()} ${TH_MON[d.getUTCMonth()]}`;
  return withTime ? `${s} ${d.toISOString().slice(11, 16)}` : s;
}
export function bkkDay(ms) { return new Date(ms + 7 * 3600000).toISOString().slice(0, 10); }

export function header({ title, sub, back, right }) {
  return h('div', { class: 'hd' }, h('div', { class: 'hrow' },
    back ? h('button', { class: 'back', onclick: () => { location.hash = back; }, 'aria-label': 'ย้อนกลับ' }, '‹') : null,
    h('div', { class: 'cls' }, h('b', {}, title), sub ? h('small', {}, sub) : null),
    right || null));
}

export function errorBox(e) { return h('div', { class: 'errmsg' }, e && e.message ? e.message : String(e || '')); }
