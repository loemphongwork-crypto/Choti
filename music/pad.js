// แพดทดลองภาคสนาม (หน้านักเรียน) — เปิด …/music/ · ใส่ห้อง + เลขที่ · เลือกข้อตามที่ครูประกาศ · เคาะตามเมโทรนอมลำโพงครู
// วัดทั้งหมดในเครื่อง แล้วส่งข้อมูลดิบเบื้องหลังเป็นชุด (เน็ตหลุด = เก็บไว้ส่งทีหลัง)
import { ITEMS, itemOf, model, scoreTaps, idleWaitMs, browserOf, frameStats, renderNota, STRICT, IN_APP } from './core.js';
import { createOutbox } from './outbox.js';
import { call, store } from '../js/api.js';

const $app = document.getElementById('app');
const UA = navigator.userAgent || '', BROWSER = browserOf(UA);
const MIN_TAPS = 3;            // รอบที่เคาะไม่ถึง 3 ครั้ง = เคาะเล่น ไม่คิดคะแนน
const OPENED_AT = Date.now();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const sCls = (v) => (v == null ? '' : v >= 8 ? 'ok' : v >= 5 ? 'warn' : 'bad');
const sColor = (v) => (v == null ? 'var(--mute)' : v >= 8 ? 'var(--ok)' : v >= 5 ? 'var(--warn)' : 'var(--bad)');
const readJ = (k, d) => { try { return JSON.parse(store.get(k) || 'null') ?? d; } catch (e) { return d; } };

let device = store.get('mt:dev');
if (!device) { device = 'd' + rid(); store.set('mt:dev', device); }
let me = readJ('mt:me', null);              // {room, no}
let itemNo = Number(store.get('mt:item')) || null;
const tries = readJ('mt:tries', []);        // ผลของฉัน (เก็บล่าสุด 30 รอบในเครื่อง)
let attempt = null, idleTimer = null, wake = null, sheet = null, lastFresh = false;

/* ---------- ส่งข้อมูล ---------- */
const outbox = createOutbox(localStorage, (rounds) => call('musicTrial', { rounds }, null, { timeoutMs: 45000 }));
outbox.onChange(paintSync);
setInterval(() => outbox.flush(), 10000);
window.addEventListener('online', () => outbox.flush(true));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') outbox.flush(true);
  else if (attempt || wake) askWake();
});

/* ---------- ความแกว่งของเฟรม: จดช่วงห่างทุกเฟรมตลอดเวลาที่เปิดหน้า ---------- */
const FR = []; // [{t, dt}] ล่าสุด ~20 วิ
let lastFrame = 0;
(function loop(t) {
  if (lastFrame) { FR.push({ t, dt: t - lastFrame }); if (FR.length > 1200) FR.splice(0, FR.length - 1200); }
  lastFrame = t;
  requestAnimationFrame(loop);
})(0);
function framesBetween(a, b) { return frameStats(FR.filter((f) => f.t >= a && f.t <= b).map((f) => f.dt)); }

/* ---------- หน้าใส่ห้อง + เลขที่ ---------- */
function renderReg() {
  const q = new URLSearchParams(location.search), pre = (q.get('r') || (me && me.room) || '').replace(/^ม\.?/, '');
  const [lv0, rm0] = pre.split('/');
  let lv = /^[1-6]$/.test(lv0 || '') ? lv0 : '';
  $app.innerHTML = `<div class="mt-reg">
    <h1>แพดเคาะจังหวะ</h1>
    <p class="lead">ทดลองใช้ในคาบดนตรี · ใส่ห้องกับเลขที่ แล้วเริ่มเคาะได้เลย ไม่ต้องใช้ PIN</p>
    <div class="field"><span>ชั้น</span><div class="chips" id="lv">${[1, 2, 3].map((n) => `<button class="chip ${String(n) === lv ? 'sel' : ''}" data-lv="${n}">ม.${n}</button>`).join('')}</div></div>
    <div class="row2">
      <label class="field"><span>ห้อง</span><input id="rm" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${esc(rm0 || '')}" placeholder="เช่น 3"></label>
      <label class="field"><span>เลขที่</span><input id="no" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${me ? me.no : ''}" placeholder="เช่น 12"></label>
    </div>
    <div class="errmsg" id="err"></div>
    <button class="btn pri big" id="go">เริ่ม</button>
    <p class="hint" style="margin-top:14px">ข้อมูลที่เก็บ: เวลาที่เคาะแต่ละครั้ง คะแนน และชนิดเบราว์เซอร์/มือถือ เพื่อดูว่าแอปวัดได้แม่นแค่ไหน</p>
  </div>`;
  $app.querySelector('#lv').onclick = (e) => {
    const b = e.target.closest('[data-lv]'); if (!b) return;
    lv = b.dataset.lv; $app.querySelectorAll('[data-lv]').forEach((x) => x.classList.toggle('sel', x === b));
  };
  $app.querySelector('#go').onclick = () => {
    const rm = $app.querySelector('#rm').value.trim(), no = Number($app.querySelector('#no').value.trim());
    const err = $app.querySelector('#err');
    if (!lv) { err.textContent = 'เลือกชั้นก่อน'; return; }
    if (!/^\d{1,2}$/.test(rm) || +rm < 1) { err.textContent = 'ใส่เลขห้อง เช่น 3'; return; }
    if (!(no >= 1 && no <= 99 && Number.isInteger(no))) { err.textContent = 'ใส่เลขที่ให้ถูก (1–99)'; return; }
    const changed = !me || me.room !== `ม.${lv}/${+rm}` || me.no !== no;
    me = { room: `ม.${lv}/${+rm}`, no };
    store.set('mt:me', JSON.stringify(me));
    if (changed) {
      outbox.push({
        kind: 'join', clientId: rid(), room: me.room, no: me.no, device, browser: BROWSER, ua: UA, clientAt: Date.now(),
        frame: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio || 1, cpu: navigator.hardwareConcurrency || null, mem: navigator.deviceMemory || null, openedAt: OPENED_AT, loadMs: Math.round(performance.now()) },
      });
      outbox.flush(true);
    }
    renderPad();
  };
}

/* ---------- หน้าแพด ---------- */
function renderPad() {
  $app.innerHTML = `
    <div class="mt-top"><div class="who">${esc(me.room)} · เลขที่ ${me.no}${IN_APP.has(BROWSER) ? ` <span class="mt-pill ${BROWSER === 'line' ? 'line' : ''}">${BROWSER === 'line' ? 'LINE' : 'ในแอป'}</span>` : ''}</div>
      <span class="mt-pill" id="sync"></span><button class="mt-link" id="change">เปลี่ยน</button></div>
    <div class="mt-items" id="items">${ITEMS.map((it) => `<button data-item="${it.no}"><b>ข้อ ${it.no}</b><small>${it.name}</small></button>`).join('')}</div>
    <div class="mt-nota" id="nota"></div>
    <div class="mt-mrow"><span class="mt-count" id="count"></span><span id="last"></span></div>
    <div class="mt-pad" id="pad" role="button" aria-label="แพดเคาะ แตะตรงไหนก็ได้"><div class="big" id="big"></div><div class="hint" id="hint"></div></div>
    <div class="mt-bot"><button class="btn" id="mine"></button></div>
    <div id="sheet"></div>`;
  $app.querySelector('#items').onclick = (e) => { const b = e.target.closest('[data-item]'); if (b) pickItem(+b.dataset.item); };
  $app.querySelector('#change').onclick = () => { dropAttempt(); renderReg(); };
  $app.querySelector('#mine').onclick = () => { sheet = 'list'; paintSheet(); };
  $app.querySelector('#last').onclick = () => { if (tries.length) { sheet = tries.length - 1; paintSheet(); } };
  $app.querySelector('#sheet').onclick = onSheetClick;
  const pad = $app.querySelector('#pad');
  pad.addEventListener('pointerdown', onPad);
  pad.addEventListener('contextmenu', (e) => e.preventDefault());
  paintAll();
}
function pickItem(no) {
  if (itemNo === no) return;
  dropAttempt(); itemNo = no; store.set('mt:item', String(no));
  paintAll();
}
function paintAll() { paintItems(); paintNota(); paintPadText(); paintLast(); paintSync(); paintMine(); }
function paintItems() { $app.querySelectorAll('[data-item]').forEach((b) => b.classList.toggle('on', +b.dataset.item === itemNo)); }
function paintNota() {
  const el = $app.querySelector('#nota'); if (!el) return;
  const it = itemOf(itemNo);
  if (!it) { el.innerHTML = '<div class="mt-wait"><b>เลือกข้อตามที่ครูบอก</b>แตะ ข้อ 1–4 ด้านบน แล้วโน้ตจะขึ้นตรงนี้</div>'; return; }
  const M = model(it), hl = attempt ? M.hits[Math.min(attempt.taps.length, M.hits.length - 1)] : null;
  el.innerHTML = `<div class="cap"><b>ข้อ ${it.no} · ${it.name}</b><span>เมโทรนอม ${it.bpm}</span></div>${renderNota(it, { syl: true, hl })}`;
}
function paintPadText() {
  const big = $app.querySelector('#big'), hint = $app.querySelector('#hint'), cnt = $app.querySelector('#count');
  if (!big) return;
  const it = itemOf(itemNo);
  if (!it) { big.className = 'big word'; big.textContent = 'เลือกข้อก่อน'; hint.textContent = 'ครูจะบอกว่าเคาะข้อไหน'; cnt.textContent = ''; return; }
  const N = model(it).hits.length;
  if (!attempt) {
    big.className = 'big word'; big.textContent = 'เคาะได้เลย';
    hint.textContent = 'เคาะตามเสียงเมโทรนอมของครู · เคาะครั้งแรก = เริ่มรอบ · หยุดเคาะ = จบรอบ';
    cnt.textContent = `รอบนี้เคาะ ${N} ครั้ง`;
  } else {
    const n = attempt.taps.length;
    big.className = 'big'; big.textContent = n;
    hint.textContent = `จาก ${N} ครั้ง · แตะตรงไหนก็ได้ในกรอบนี้`;
    cnt.textContent = 'กำลังเคาะ…';
  }
}
function paintLast() {
  const el = $app.querySelector('#last'); if (!el) return;
  const x = tries[tries.length - 1];
  el.innerHTML = x ? `<button class="mt-chip ${sCls(x.r.score)} ${lastFresh ? 'pop' : ''}">${x.r.score} ${x.r.score >= 5 ? '✓' : ''} · ข้อ ${x.item} ›</button>` : '';
  lastFresh = false;
}
function paintSync() {
  const el = $app.querySelector('#sync'); if (!el) return;
  const s = outbox.state();
  if (s.pending) { el.className = 'mt-pill wait'; el.textContent = s.busy ? 'กำลังส่ง…' : `รอส่ง ${s.pending}`; }
  else { el.className = 'mt-pill ok'; el.textContent = 'ส่งแล้ว ✓'; }
}
function paintMine() { const b = $app.querySelector('#mine'); if (b) b.textContent = `ผลของฉัน (${tries.length})`; }

/* ---------- เคาะ ---------- */
function askWake() {
  try { if (navigator.wakeLock && !wake) navigator.wakeLock.request('screen').then((w) => { wake = w; w.addEventListener('release', () => { wake = null; }); }).catch(() => {}); } catch (e) { /* ไม่รองรับ */ }
}
function onPad(e) {
  if (e.preventDefault) e.preventDefault();
  const now = performance.now();
  // เวลาจริงของการแตะ (e.timeStamp) · บางเครื่องให้ค่าแปลก → ใช้เวลาตอนนี้แทน
  let t = e.timeStamp;
  if (!(t > 0) || t > now + 5 || now - t > 1000) t = now;
  const delay = now - t, pad = e.currentTarget || $app.querySelector('#pad');
  pad.classList.add('hit'); setTimeout(() => pad.classList.remove('hit'), 70);
  askWake();
  const it = itemOf(itemNo);
  if (!it) { const h = $app.querySelector('#hint'); if (h) h.textContent = '👆 เลือกข้อด้านบนก่อน'; return; }
  const M = model(it), N = M.hits.length;
  if (!attempt) attempt = { item: it.no, bpm: it.bpm, taps: [], delays: [], startedAt: Date.now() };
  attempt.taps.push(t); attempt.delays.push(delay);
  paintPadText(); paintNota();
  clearTimeout(idleTimer);
  // จบรอบ: เคาะครบจำนวน = จบทันที · หยุดเคาะนานเกินเกณฑ์ (ข้อ 9) = จบ
  if (attempt.taps.length >= N) endAttempt();
  else idleTimer = setTimeout(endAttempt, idleWaitMs(it, attempt.bpm));
}
function dropAttempt() { clearTimeout(idleTimer); attempt = null; }
function endAttempt() {
  clearTimeout(idleTimer);
  const a = attempt; attempt = null;
  if (!a) return;
  if (a.taps.length < MIN_TAPS) { paintPadText(); paintNota(); const h = $app.querySelector('#hint'); if (h) h.textContent = 'เคาะสั้นเกินไป ไม่คิดคะแนน · เริ่มใหม่ได้เลย'; return; }
  const it = itemOf(a.item), r = scoreTaps(it, a.taps, a.bpm, 'norm');
  const t0 = a.taps[0], frame = framesBetween(t0 - 500, a.taps[a.taps.length - 1] + 200);
  outbox.push({
    kind: 'round', clientId: rid(), room: me.room, no: me.no, device, item: it.no, bpm: a.bpm, score: r.score,
    taps: a.taps.map((x) => Math.round((x - t0) * 10) / 10), delays: a.delays.map((x) => Math.round(x)),
    result: { ok: r.ok, near: r.near, miss: r.miss, extra: r.extra, N: r.N, tempo: r.tempo, bpm: r.bpm, strict: 'norm', errs: r.errs, ended: a.taps.length >= r.N ? 'full' : 'idle' },
    frame, browser: BROWSER, ua: UA, clientAt: a.startedAt,
  });
  outbox.flush();
  tries.push({ item: it.no, bpm: a.bpm, at: a.startedAt, r: { score: r.score, verdict: r.verdict, why: r.why, ok: r.ok, near: r.near, miss: r.miss, extra: r.extra, bpm: r.bpm, states: r.states } });
  if (tries.length > 30) tries.splice(0, tries.length - 30);
  store.set('mt:tries', JSON.stringify(tries));
  lastFresh = true;
  paintPadText(); paintNota(); paintLast(); paintMine();
}

/* ---------- แผ่นผล ---------- */
function paintSheet() {
  const el = $app.querySelector('#sheet'); if (!el) return;
  if (sheet == null) { el.innerHTML = ''; return; }
  if (sheet === 'list') {
    el.innerHTML = `<div class="mt-sheet" data-k="bg"><div class="in">
      <div class="hrow"><b class="grow" style="font-size:16px">ผลของฉัน</b><button class="btn" data-k="close">ปิด</button></div>
      ${tries.length ? `<div class="mt-hist">${tries.map((x, i) => `<button data-k="open" data-i="${i}"><span>รอบที่ ${i + 1} · ข้อ ${x.item}</span><b style="color:${sColor(x.r.score)}">${x.r.score} ${esc(x.r.verdict)} ›</b></button>`).reverse().join('')}</div>`
        : '<div class="small">ยังไม่มีรอบที่คิดคะแนน · เลือกข้อแล้วเคาะบนแพดได้เลย</div>'}
      <div class="small">ทุกรอบส่งให้ครูเองอัตโนมัติ ไม่ต้องกดส่ง</div></div></div>`;
    return;
  }
  const x = tries[sheet]; if (!x) { sheet = null; el.innerHTML = ''; return; }
  const it = itemOf(x.item), r = x.r;
  el.innerHTML = `<div class="mt-sheet" data-k="bg"><div class="in">
    <div class="hrow"><div class="grow"><b style="font-size:16px">รอบที่ ${sheet + 1} · ข้อ ${it.no}</b><div class="small">${it.name} · เมโทรนอม ${x.bpm} · ความเข้ม${STRICT.norm.t}</div></div><button class="btn" data-k="close">ปิด</button></div>
    <div class="mt-card">
      <div class="hrow"><div class="mt-score grow"><b style="color:${sColor(r.score)}">${r.score}</b><span>/ 10</span></div><span class="pill" style="background:#f1f2f5;color:${sColor(r.score)}">${esc(r.verdict)}</span></div>
      ${r.why ? `<div class="small" style="margin-top:6px">${esc(r.why)}</div>` : ''}
      <div class="mt-stat4"><div><b style="color:var(--ok)">${r.ok}</b><small>ตรง</small></div><div><b style="color:var(--warn)">${r.near}</b><small>ใกล้เคียง</small></div><div><b style="color:var(--bad)">${r.miss}</b><small>พลาด</small></div><div><b>${r.extra}</b><small>เคาะเกิน</small></div></div>
      <div class="small" style="margin-top:8px">ความเร็วที่เคาะได้ ${r.bpm ? Math.round(r.bpm) : '–'} · เมโทรนอม ${x.bpm}</div>
    </div>
    <div class="mt-card">${renderNota(it, { syl: true, states: r.states })}</div>
    <div class="small">ปิดแผ่นนี้แล้วเคาะรอบต่อไปได้เลย</div>
  </div></div>`;
}
function onSheetClick(e) {
  const b = e.target.closest('[data-k]'); if (!b) return;
  const k = b.dataset.k;
  if (k === 'bg') { if (e.target === b) { sheet = null; paintSheet(); } return; }
  if (k === 'close') { sheet = null; paintSheet(); }
  if (k === 'open') { sheet = +b.dataset.i; paintSheet(); }
}

/* แป้น Space = แตะแพด (ลองบนคอมพิวเตอร์) */
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat || sheet != null) return;
  const pad = $app.querySelector('#pad'); if (!pad) return;
  e.preventDefault();
  onPad({ timeStamp: e.timeStamp, currentTarget: pad });
});

if (me) renderPad(); else renderReg();
outbox.flush(true);
