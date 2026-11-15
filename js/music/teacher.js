// ครู: แพดทดลองเคาะจังหวะ (#/t/music) — ลิงก์/QR ให้นักเรียน · เมโทรนอมออกลำโพงครู · ใครส่งข้อมูลแล้ว · สรุปรายเครื่อง
import { T } from '../api.js';
import { h, header, errorBox, toast } from '../ui.js';
import { ITEMS, itemOf, model, summarize, STRICT, BROWSER_TH, IN_APP } from '../../music/core.js';

const CSS = `
.mtt-tbl{overflow-x:auto;margin:0 -14px;padding:0 14px}
.mtt-tbl table{border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums;min-width:100%}
.mtt-tbl th{font-size:11px;color:var(--mute);font-weight:600;text-align:right;padding:4px 5px;border-bottom:1px solid var(--line);white-space:nowrap}
.mtt-tbl td{padding:6px 5px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
.mtt-tbl th:first-child,.mtt-tbl td:first-child{text-align:left;position:sticky;left:0;background:#fff}
.mtt-ok{color:var(--ok);font-weight:700}.mtt-warn{color:#b45309;font-weight:700}.mtt-bad{color:var(--abs);font-weight:700}
.mtt-bpm{font-size:44px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;text-align:center}
.mtt-dots{display:flex;gap:10px;justify-content:center;margin:8px 0 12px}
.mtt-dots i{width:16px;height:16px;border-radius:50%;background:#dfe3ea;transition:background .05s,transform .05s}
.mtt-dots i.lit{background:var(--pri);transform:scale(1.2)}
.mtt-kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;text-align:center}
.mtt-kpi div{background:#f1f2f5;border-radius:10px;padding:8px 2px}
.mtt-kpi b{display:block;font-size:20px}
.mtt-kpi small{font-size:11px;color:var(--mute)}
.mtt-url{font-size:13px;word-break:break-all;background:#f1f2f5;border-radius:10px;padding:8px 10px;margin:6px 0}
`;

const scoreCls = (v) => (v == null ? '' : v >= 8 ? 'mtt-ok' : v >= 5 ? 'mtt-warn' : 'mtt-bad');
const hhmm = (ms) => (ms ? new Date(ms + 7 * 3600000).toISOString().slice(11, 16) : '–');
const today = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
export function padUrl() { return location.origin + location.pathname.replace(/[^/]*$/, '') + 'music/'; }

/* ---------- เมโทรนอม (Web Audio, ตั้งเวลาล่วงหน้า กันจังหวะเพี้ยน) ---------- */
function createMetronome(onBeat) {
  let ac = null, timer = null, next = 0, k = 0, bpm = 80, bpb = 4, sound = 'wood';
  const tone = (f, t, d, p, type) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(p, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.002 + d);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + 0.05);
  };
  const click = (t, acc) => { if (sound === 'click') tone(acc ? 1900 : 1250, t, 0.03, 0.35, 'square'); else tone(acc ? 1150 : 880, t, 0.07, 0.9, 'sine'); };
  function tick() {
    while (next < ac.currentTime + 0.12) {
      const b = k % bpb;
      click(next, b === 0);
      const delay = Math.max(0, (next - ac.currentTime) * 1000);
      setTimeout(() => onBeat(b), delay);
      k++; next += 60 / bpm;
    }
  }
  return {
    get running() { return !!timer; },
    start(v, beats) {
      if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) throw new Error('เครื่องนี้เล่นเสียงไม่ได้'); ac = new C(); }
      if (ac.state === 'suspended') ac.resume();
      bpm = v; bpb = beats; k = 0; next = ac.currentTime + 0.15;
      clearInterval(timer); timer = setInterval(tick, 25); tick();
    },
    setBpm(v) { bpm = v; },
    setSound(s) { sound = s; },
    stop() { clearInterval(timer); timer = null; onBeat(-1); },
  };
}

/* ---------- QR (ตัวสร้างโหลดจาก cdnjs ตอนกดครั้งแรก) ---------- */
let qrLib;
function loadQr() {
  if (window.QRCode) return Promise.resolve();
  qrLib = qrLib || new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = res; s.onerror = () => { qrLib = null; rej(new Error('โหลดตัวสร้าง QR ไม่ได้ (ตรวจอินเทอร์เน็ต)')); };
    document.head.append(s);
  });
  return qrLib;
}

export async function render(app) {
  if (!document.getElementById('mtt-css')) document.head.append(h('style', { id: 'mtt-css' }, CSS));
  const body = h('div', { class: 'body pad' });
  app.append(header({ title: 'แพดทดลองเคาะจังหวะ', sub: 'ทดลองภาคสนาม 1 คาบ', back: '#/t' }), body);
  let strict = 'norm', room = '', day = today(), data = null, refreshTimer = null, alive = true;

  /* ลิงก์ให้นักเรียน */
  const url = padUrl(), qrBox = h('div', { style: 'display:flex;justify-content:center' });
  const linkCard = h('div', { class: 's-card' }, h('h4', {}, 'ลิงก์ให้นักเรียน'),
    h('p', { class: 'hint', style: 'margin:0' }, 'นักเรียนเปิดลิงก์ ใส่ห้อง + เลขที่ (ไม่ต้องใช้ PIN) แล้วเลือกข้อตามที่ครูประกาศ'),
    h('div', { class: 'mtt-url' }, url),
    h('div', { class: 'hrow' },
      h('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์แล้ว'); } catch (e) { toast('คัดลอกไม่ได้ กดค้างที่ลิงก์แทน'); } } }, 'คัดลอก'),
      h('button', { class: 'btn', onclick: async () => {
        try { await loadQr(); qrBox.replaceChildren(); new window.QRCode(qrBox, { text: url, width: 220, height: 220 }); } catch (e) { qrBox.replaceChildren(errorBox(e)); }
      } }, '▣ QR')), qrBox);

  /* เมโทรนอม */
  let mItem = 1;
  const dots = h('div', { class: 'mtt-dots' });
  const metro = createMetronome((b) => dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('lit', i === b)));
  const bpmEl = h('div', { class: 'mtt-bpm' }), itemChips = h('div', { class: 'chips', style: 'justify-content:center' });
  const playBtn = h('button', { class: 'btn pri big' });
  const soundChips = h('div', { class: 'chips', style: 'justify-content:center;margin-top:8px' });
  let sound = 'wood';
  const paintMetro = () => {
    const it = itemOf(mItem);
    bpmEl.replaceChildren(String(it.bpm), h('div', { class: 'hint', style: 'font-size:12px;font-weight:600' }, `BPM · ข้อ ${it.no} ${it.name}`));
    dots.replaceChildren(...Array.from({ length: model(it).bpb }, () => h('i')));
    itemChips.replaceChildren(...ITEMS.map((x) => h('button', { class: 'chip' + (x.no === mItem ? ' sel' : ''), onclick: () => {
      mItem = x.no; if (metro.running) { metro.stop(); metro.start(itemOf(mItem).bpm, model(itemOf(mItem)).bpb); } paintMetro();
    } }, 'ข้อ ' + x.no)));
    soundChips.replaceChildren(...[['wood', 'บล็อกไม้'], ['click', 'คลิก']].map(([k, v]) => h('button', { class: 'chip' + (sound === k ? ' sel' : ''), onclick: () => { sound = k; metro.setSound(k); paintMetro(); } }, v)));
    playBtn.textContent = metro.running ? '■ หยุดเมโทรนอม' : '▶ เล่นเมโทรนอม';
  };
  let wake = null;
  playBtn.onclick = () => {
    try {
      if (metro.running) { metro.stop(); if (wake) { wake.release().catch(() => {}); wake = null; } } else {
        const it = itemOf(mItem); metro.start(it.bpm, model(it).bpb);
        // กันจอครูดับ (จอดับ = เสียงเมโทรนอมหยุด)
        if (navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => { wake = w; }).catch(() => {});
      }
    } catch (e) { toast(e.message); }
    paintMetro();
  };
  paintMetro();
  const metroCard = h('div', { class: 's-card' }, h('h4', {}, 'เมโทรนอม (ต่อลำโพง)'),
    h('p', { class: 'hint', style: 'margin:0 0 8px' }, 'เลือกข้อเดียวกับที่ประกาศให้นักเรียน · ความเร็วตามโจทย์ · มือถือนักเรียนไม่มีนับนำ เคาะตามเสียงนี้ได้เลย'),
    itemChips, h('div', { style: 'margin-top:10px' }, bpmEl), dots, playBtn, soundChips);

  /* ผล */
  const resBox = h('div');
  const strictChips = h('div', { class: 'chips' });
  const dayInput = h('input', { type: 'date', value: day, style: 'border:1px solid var(--line);border-radius:10px;padding:6px 8px;min-height:40px', onchange: (e) => { day = e.target.value || today(); load(); } });
  const paintStrict = () => strictChips.replaceChildren(...Object.entries(STRICT).map(([k, v]) => h('button', { class: 'chip' + (strict === k ? ' sel' : ''), onclick: () => { strict = k; paintStrict(); paint(); } }, v.t)));
  paintStrict();
  const resCard = h('div', { class: 's-card' },
    h('div', { class: 'hrow' }, h('h4', { style: 'margin:0', class: 'spacer' }, 'ผลที่ส่งมา'), dayInput, h('button', { class: 'btn', onclick: () => load() }, '↻')),
    h('div', { class: 'hrow', style: 'margin:8px 0' }, h('span', { class: 'hint' }, 'คิดคะแนนใหม่ด้วยเกณฑ์'), strictChips),
    resBox);

  body.append(linkCard, metroCard, resCard);

  async function load() {
    try {
      data = await T('musicTrialView', { day });
      paint();
    } catch (e) { if (alive) resBox.replaceChildren(errorBox(e)); }
  }
  function paint() {
    if (!data) { resBox.replaceChildren(h('div', { class: 'hint' }, 'กำลังโหลด…')); return; }
    const rows = data.rows || [];
    const rooms = [...new Set(rows.map((r) => r.room))].sort((a, b) => a.localeCompare(b, 'th'));
    if (room && !rooms.includes(room)) room = '';
    if (!room && rooms.length) room = rooms[rooms.length - 1];
    if (!rows.length) { resBox.replaceChildren(h('div', { class: 'hint' }, 'ยังไม่มีข้อมูลวันนี้ · เมื่อนักเรียนเปิดลิงก์และใส่เลขที่ ชื่อจะขึ้นที่นี่ (อัปเดตเองทุก 20 วินาที)')); return; }
    const people = summarize(rows.filter((r) => r.room === room), strict);
    const joins = people.map((p) => p.joinAt || p.firstAt).filter(Boolean).sort((a, b) => a - b);
    const tapped = people.filter((p) => p.rounds);
    const allRounds = tapped.reduce((a, p) => a + p.rounds, 0);
    const avgAll = tapped.length ? (tapped.reduce((a, p) => a + p.avg * p.rounds, 0) / allRounds).toFixed(1) : '–';
    const span = joins.length > 1 ? Math.round((joins[joins.length - 1] - joins[0]) / 60000) : 0;
    const kids = [];
    if (rooms.length > 1) kids.push(h('div', { class: 'chips', style: 'margin-bottom:8px' }, rooms.map((r) => h('button', { class: 'chip' + (r === room ? ' sel' : ''), onclick: () => { room = r; paint(); } }, r))));
    kids.push(h('div', { class: 'mtt-kpi' },
      h('div', {}, h('b', {}, String(people.length)), h('small', {}, 'เข้าแล้ว (คน)')),
      h('div', {}, h('b', {}, String(tapped.length)), h('small', {}, `เคาะแล้ว · ${allRounds} รอบ`)),
      h('div', {}, h('b', { class: scoreCls(Number(avgAll)) }, avgAll), h('small', {}, 'คะแนนเฉลี่ย'))));
    kids.push(h('p', { class: 'hint', style: 'margin:8px 0' }, joins.length
      ? `คนแรกเข้า ${hhmm(joins[0])} · คนล่าสุด ${hhmm(joins[joins.length - 1])} · ทั้งห้องเข้าได้ใน ${span} นาที`
      : ''));
    kids.push(browserTable(people));
    kids.push(h('div', { class: 'sec-t' }, 'รายคน'));
    kids.push(personTable(people, data.nicks || {}));
    kids.push(h('p', { class: 'hint', style: 'margin-top:8px;line-height:1.5' },
      'คลาด = ระยะห่างจากจุดที่ควรเคาะ (มัธยฐาน, % ของ 1 จังหวะ) · ใน 15% = สัดส่วนโน้ตที่นับว่า "ตรง" ตามเกณฑ์ปกติ · แกว่ง ข้อ 1 = ช่วงห่างการเคาะตัวดำต่างกันแค่ไหน (เด็ก + เครื่อง) · เฟรม = จอกระตุกแค่ไหน (ms, ยิ่งน้อยยิ่งดี) · หน่วง = เวลาจากแตะจนแอปรับรู้ (ms) · ข้อมูลดิบทั้งหมดอยู่ในชีต MusicTrial'));
    resBox.replaceChildren(...kids);
  }
  function browserTable(people) {
    const g = {};
    people.forEach((p) => p.browsers.forEach((b) => { (g[b] ||= []).push(p); }));
    const keys = Object.keys(g).sort((a, b) => g[b].length - g[a].length);
    if (!keys.length) return h('div');
    const avg = (xs) => { const v = xs.filter((x) => x != null); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '–'; };
    return h('div', { class: 'mtt-tbl' }, h('table', {},
      h('thead', {}, h('tr', {}, ['เบราว์เซอร์', 'คน', 'เฉลี่ย', 'คลาด%', 'ใน 15%', 'เฟรม'].map((t) => h('th', {}, t)))),
      h('tbody', {}, keys.map((k) => h('tr', {},
        h('td', {}, (BROWSER_TH[k] || k) + (IN_APP.has(k) ? ' ⚠' : '')),
        h('td', {}, String(g[k].length)),
        h('td', {}, avg(g[k].map((p) => p.avg))),
        h('td', {}, avg(g[k].map((p) => p.errMed))),
        h('td', {}, avg(g[k].map((p) => p.in15))),
        h('td', {}, avg(g[k].map((p) => p.frameSd))))))));
  }
  function personTable(people, nicks) {
    const d = (v, suf = '') => (v == null ? '–' : v + suf);
    return h('div', { class: 'mtt-tbl' }, h('table', {},
      h('thead', {}, h('tr', {}, ['เลขที่', 'รอบ', 'เฉลี่ย', ...ITEMS.map((it) => 'ข้อ ' + it.no), 'คลาด%', 'ใน 15%', 'แกว่ง ข้อ1', 'เฟรม', 'หน่วง', 'เครื่อง', 'เข้า'].map((t) => h('th', {}, t)))),
      h('tbody', {}, people.map((p) => {
        const nick = nicks[p.room + '|' + p.no];
        const br = p.browsers.map((b) => BROWSER_TH[b] || b).join(', ') + (p.devices.length > 1 ? ` (${p.devices.length} เครื่อง)` : '');
        return h('tr', {},
          h('td', {}, h('b', {}, String(p.no)), nick ? ' ' + nick : ''),
          h('td', {}, String(p.rounds)),
          h('td', { class: scoreCls(p.avg) }, d(p.avg)),
          ...ITEMS.map((it) => h('td', { class: scoreCls(p.byItem[it.no]) }, d(p.byItem[it.no]))),
          h('td', {}, d(p.errMed)), h('td', {}, d(p.in15, '%')), h('td', {}, d(p.cv1, '%')),
          h('td', {}, d(p.frameSd) + (p.longFrames ? ` (${p.longFrames})` : '')), h('td', {}, d(p.delayMed)),
          h('td', { style: 'text-align:left' }, br), h('td', {}, hhmm(p.joinAt || p.firstAt)));
      }))));
  }

  paint();
  await load();
  const tick = () => { if (!alive) return; if (document.visibilityState === 'visible') load(); refreshTimer = setTimeout(tick, 20000); };
  refreshTimer = setTimeout(tick, 20000);
  return () => { alive = false; clearTimeout(refreshTimer); metro.stop(); if (wake) wake.release().catch(() => {}); };
}
