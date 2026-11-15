// แพดทดลองภาคสนาม — ส่วนกลาง (ไม่แตะ DOM เพื่อให้ทดสอบได้): โจทย์ · คิดคะแนนจากช่วงห่าง · วาดโน้ต · สรุปผลรายเครื่อง
// ตรรกะคิดคะแนนยกมาจากเดโม เคาะจังหวะ/แพดซ้อม-เดโม.html (ข้อ 4 + 13.7 ในข้อมูลออกแบบหน้าจอ)

/** โจทย์ตายตัว 4 ข้อ (4/4) — ครูประกาศข้อ นักเรียนกดเลือกเอง */
export const ITEMS = [
  { no: 1, name: 'ตัวดำ', ts: { n: 4, d: 4 }, bpm: 80, seq: 'q q q q | q q q q | q q q q | q q q q' },
  { no: 2, name: 'ตัวดำ + ตัวขาว', ts: { n: 4, d: 4 }, bpm: 80, seq: 'q q h | q q h | h q q | h h' },
  { no: 3, name: 'เขบ็ด 1 ชั้น', ts: { n: 4, d: 4 }, bpm: 72, seq: 'q q e e q | e e q e e q | q e e q q | e e e e h' },
  { no: 4, name: 'ตัวหยุด', ts: { n: 4, d: 4 }, bpm: 80, seq: 'q qr q qr | q q h | qr q qr q | q q h' },
];
export const itemOf = (no) => ITEMS.find((i) => i.no === Number(no)) || null;

/** ความเข้มการตรวจ: % ของ 1 จังหวะ หรือค่าขั้นต่ำ ms (เอาค่าที่มากกว่า) */
export const STRICT = {
  easy: { t: 'ง่าย', ok: 0.20, near: 0.35, ms: 70 },
  norm: { t: 'ปกติ', ok: 0.15, near: 0.30, ms: 60 },
  hard: { t: 'เข้ม', ok: 0.10, near: 0.20, ms: 40 },
};

const BASE = { w: 4, h: 2, q: 1, e: 0.5 };
const MODELS = new Map();
export function model(it) {
  if (MODELS.has(it)) return MODELS.get(it);
  const { n, d } = it.ts, compound = d === 8 && n % 3 === 0 && n > 3;
  const barLen = n * 4 / d, beatQ = compound ? 1.5 : 4 / d, bpb = compound ? n / 3 : n;
  const notes = []; let pos = 0, tieOpen = false;
  it.seq.split(/\s+/).forEach((tok) => {
    if (!tok || tok === '|') return;
    const parts = tok.split('~');
    parts.forEach((p, pi) => {
      const m = p.match(/^([whqe])(r?)(\.?)$/); if (!m) return;
      const dur = BASE[m[1]] * (m[3] ? 1.5 : 1), bar = Math.floor(pos / barLen + 1e-9);
      const nt = { d: m[1], dot: !!m[3], rest: !!m[2], dur, pos, bar, inBar: +(pos - bar * barLen).toFixed(4), tiedFrom: tieOpen, tieNext: false };
      tieOpen = false;
      if (pi < parts.length - 1) { nt.tieNext = true; tieOpen = true; }
      notes.push(nt); pos += dur;
    });
  });
  const hits = []; notes.forEach((x, i) => { if (!x.rest && !x.tiedFrom) hits.push(i); });
  const onsets = hits.map((i) => notes[i].pos / beatQ);
  // ความยาวของแต่ละการเคาะ (รวมตัวหยุดที่ตามมา) หน่วย = จังหวะ
  const gaps = onsets.map((o, k) => (k < onsets.length - 1 ? onsets[k + 1] : pos / beatQ) - o);
  const M = { notes, total: pos, barLen, beatQ, bpb, compound, bars: Math.round(pos / barLen), hits, onsets, maxGap: Math.max(...gaps) };
  MODELS.set(it, M);
  return M;
}

/** รอนานเท่าไรหลังเคาะครั้งล่าสุดจึงถือว่าจบรอบ (ข้อ 9): 1.6 เท่าของช่วงยาวสุด + 2 จังหวะ อย่างน้อย 4 วินาที */
export function idleWaitMs(it, bpm) {
  const beat = 60000 / (bpm || it.bpm);
  return Math.max(4000, (model(it).maxGap * 1.6 + 2) * beat);
}

export function matchTaps(on, taps, A, B, win) {
  const best = on.map(() => ({ ti: -1, e: Infinity }));
  taps.forEach((t, ti) => {
    let bj = -1, be = Infinity;
    for (let j = 0; j < on.length; j++) { const e = Math.abs(t - (A + B * on[j])) / B; if (e < be) { be = e; bj = j; } }
    if (be <= win && be < best[bj].e) best[bj] = { ti, e: be };
  });
  return best;
}

/** คิดคะแนน 1 รอบจากเวลาที่เคาะ (ms) — หาความเร็ว + จุดเริ่มที่เข้ากับการเคาะที่สุดก่อน แล้วดูโน้ตทีละตัว */
export function scoreTaps(it, taps, bpm, strictKey) {
  bpm = bpm || it.bpm;
  const M = model(it), on = M.onsets, N = on.length, base = 60000 / bpm, S = STRICT[strictKey || 'norm'] || STRICT.norm;
  if (taps.length < 2) {
    return { score: 0, verdict: 'ไม่ผ่าน', why: 'เคาะน้อยเกินไป', states: {}, ok: 0, near: 0, miss: N, extra: Math.max(0, taps.length - N), N, tempo: 0, bpm: 0, A: 0, B: base, okF: S.ok, nearF: S.near, win: 0.45, errs: on.map(() => null) };
  }
  let fit = null;
  for (let a = 0; a < Math.min(3, taps.length); a++) for (let k = 0; k < Math.min(3, N); k++) {
    for (let s = 0.5; s <= 2.0001; s *= 1.01) {
      const B = base * s, A = taps[a] - B * on[k], m = matchTaps(on, taps, A, B, 0.45); let cost = 0, used = 0;
      m.forEach((x) => { if (x.ti < 0) cost += 0.5; else { cost += Math.min(x.e, 0.5); used++; } });
      cost += (taps.length - used) * 0.35;
      if (!fit || cost < fit.cost) fit = { cost, A, B };
    }
  }
  let { A, B } = fit;
  for (let it2 = 0; it2 < 2; it2++) {
    const m = matchTaps(on, taps, A, B, 0.45), xs = [], ys = [];
    m.forEach((x, j) => { if (x.ti >= 0) { xs.push(on[j]); ys.push(taps[x.ti]); } });
    if (xs.length >= 2) {
      const n = xs.length, mx = xs.reduce((p, q) => p + q) / n, my = ys.reduce((p, q) => p + q) / n; let sxy = 0, sxx = 0;
      for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
      if (sxx > 0) { const nb = sxy / sxx; if (nb > base * 0.4 && nb < base * 2.5) { B = nb; A = my - B * mx; } }
    }
  }
  const okF = Math.max(S.ok, S.ms / B), nearF = Math.max(S.near, okF * 1.8), win = Math.max(0.45, nearF + 0.1);
  const m = matchTaps(on, taps, A, B, win), states = {}, errs = [];
  let credit = 0, ok = 0, near = 0, miss = 0, used = 0;
  m.forEach((x, j) => {
    if (x.ti >= 0) used++;
    let st = 'miss';
    if (x.ti >= 0 && x.e <= okF) { st = 'ok'; credit += 1; ok++; } else if (x.ti >= 0 && x.e <= nearF) { st = 'near'; credit += 0.5; near++; } else miss++;
    states[M.hits[j]] = st;
    errs.push(x.ti >= 0 ? +((taps[x.ti] - (A + B * on[j])) / B).toFixed(3) : null);
  });
  const extra = taps.length - used, penalty = Math.max(0, extra - 1) / N;
  const realBpm = 60000 / B, tempo = realBpm / bpm - 1, ad = Math.abs(tempo);
  const tf = ad <= 0.15 ? 1 : ad <= 0.30 ? 0.8 : 0;
  const score = Math.round(Math.max(0, credit / N - penalty) * tf * 10 * 2) / 2;
  let verdict = score >= 8 ? 'ดีมาก' : score >= 5 ? 'ผ่าน' : 'ยังไม่ผ่าน', why = '';
  if (tf === 0) { verdict = 'ไม่ผ่าน'; why = `เคาะ${tempo > 0 ? 'เร็ว' : 'ช้า'}กว่าเมโทรนอมมากเกินไป`; } else if (tf < 1) why = `เคาะ${tempo > 0 ? 'เร็ว' : 'ช้า'}กว่าเมโทรนอมพอสมควร คะแนนลดลง`;
  else if (penalty > 0) why = 'เคาะเกินหลายครั้ง ถูกหักคะแนน';
  else if (miss) why = 'ดูโน้ตสีแดง ตรงนั้นยังคลาดจังหวะ';
  return { score, verdict, why, states, ok, near, miss, extra, N, tempo: +tempo.toFixed(4), bpm: +realBpm.toFixed(1), A, B, okF, nearF, win, errs };
}

/* ---------- ข้อมูลเครื่อง ---------- */
/** ดูจาก user agent ว่าเปิดในเบราว์เซอร์ไหน (เบราว์เซอร์ในแอป LINE/Facebook = ปัญหาที่อยากรู้) */
export function browserOf(ua) {
  ua = String(ua || '');
  if (/\bLine\//i.test(ua)) return 'line';
  if (/FBAN|FBAV|FB_IAB|Instagram|Messenger/i.test(ua)) return 'facebook';
  if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return 'tiktok';
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/EdgA?\//.test(ua)) return 'edge';
  if (/CriOS|Chrome\//.test(ua) && !/; wv\)/.test(ua)) return 'chrome';
  if (/; wv\)/.test(ua)) return 'webview';
  if (/Firefox|FxiOS/.test(ua)) return 'firefox';
  if (/Safari\//.test(ua) && /iPhone|iPad|Macintosh/.test(ua)) return 'safari';
  return 'other';
}
export const BROWSER_TH = { line: 'LINE', facebook: 'Facebook', tiktok: 'TikTok', samsung: 'Samsung', edge: 'Edge', chrome: 'Chrome', webview: 'แอปอื่น', firefox: 'Firefox', safari: 'Safari', other: 'อื่น ๆ' };
export const IN_APP = new Set(['line', 'facebook', 'tiktok', 'webview']);

/** สถิติช่วงห่างของเฟรม (ms) — ความแกว่งของจอระหว่างเคาะ */
export function frameStats(intervals) {
  const xs = intervals.filter((x) => x > 0 && x < 1000);
  if (!xs.length) return null;
  const n = xs.length, mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const s = [...xs].sort((a, b) => a - b);
  return { n, mean: +mean.toFixed(2), sd: +sd.toFixed(2), p95: +s[Math.min(n - 1, Math.floor(n * 0.95))].toFixed(1), max: +s[n - 1].toFixed(1), long: xs.filter((x) => x > 50).length };
}

const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const parse = (s, d) => { if (s == null || s === '') return d; if (typeof s !== 'string') return s; try { return JSON.parse(s); } catch (e) { return d; } };

/** ความแกว่งของช่วงห่างการเคาะ (% ของค่าเฉลี่ย) — ใช้กับข้อ 1 ที่ทุกช่วงยาวเท่ากัน */
export function intervalCV(taps) {
  const iv = []; for (let i = 1; i < taps.length; i++) iv.push(taps[i] - taps[i - 1]);
  if (iv.length < 3) return null;
  const m = mean(iv); if (!m) return null;
  return Math.sqrt(mean(iv.map((x) => (x - m) ** 2))) / m;
}

/**
 * สรุปข้อมูลดิบจากชีตเป็นรายคน (ห้อง + เลขที่) — คิดคะแนนใหม่จากเวลาเคาะดิบได้ตามความเข้มที่เลือก
 * rows: แถวจาก musicTrialView · คืน [{key, room, no, devices, browsers, rounds, avg, best, byItem, errMed, in15, in30, cv1, frameSd, longFrames, delayMed, firstAt, joinAt}]
 */
export function summarize(rows, strictKey) {
  const seen = new Set(), people = new Map();
  const get = (r) => {
    const key = r.room + '|' + r.no;
    if (!people.has(key)) people.set(key, { key, room: r.room, no: r.no, devices: new Set(), browsers: new Set(), scores: [], byItem: {}, errs: [], cv1: [], frameSd: [], longFrames: 0, delays: [], firstAt: null, joinAt: null });
    return people.get(key);
  };
  rows.forEach((r) => {
    if (r.clientId) { if (seen.has(r.clientId)) return; seen.add(r.clientId); }
    const p = get(r), at = r.clientAt || r.createdAt;
    if (r.device) p.devices.add(r.device);
    if (r.browser) p.browsers.add(r.browser);
    if (r.kind === 'join') { if (at && (!p.joinAt || at < p.joinAt)) p.joinAt = at; return; }
    const it = itemOf(r.item), taps = parse(r.taps, []);
    if (!it || !Array.isArray(taps)) return;
    if (at && (!p.firstAt || at < p.firstAt)) p.firstAt = at;
    const res = scoreTaps(it, taps, r.bpm || it.bpm, strictKey);
    p.scores.push(res.score);
    (p.byItem[it.no] ||= []).push(res.score);
    res.errs.forEach((e) => { if (e != null) p.errs.push(Math.abs(e)); });
    if (it.no === 1) { const cv = intervalCV(taps); if (cv != null) p.cv1.push(cv); }
    const fr = parse(r.frame, null);
    if (fr && fr.sd != null) { p.frameSd.push(fr.sd); p.longFrames += fr.long || 0; }
    const dl = parse(r.delays, []);
    if (Array.isArray(dl)) dl.forEach((x) => { if (typeof x === 'number' && x >= 0) p.delays.push(x); });
  });
  return [...people.values()].map((p) => ({
    key: p.key, room: p.room, no: p.no,
    devices: [...p.devices], browsers: [...p.browsers],
    rounds: p.scores.length,
    avg: p.scores.length ? +mean(p.scores).toFixed(1) : null,
    best: p.scores.length ? Math.max(...p.scores) : null,
    byItem: Object.fromEntries(Object.entries(p.byItem).map(([k, v]) => [k, +mean(v).toFixed(1)])),
    errMed: p.errs.length ? +(median(p.errs) * 100).toFixed(1) : null,
    in15: p.errs.length ? Math.round(p.errs.filter((e) => e <= 0.15).length / p.errs.length * 100) : null,
    in30: p.errs.length ? Math.round(p.errs.filter((e) => e <= 0.30).length / p.errs.length * 100) : null,
    cv1: p.cv1.length ? +(median(p.cv1) * 100).toFixed(1) : null,
    frameSd: p.frameSd.length ? +median(p.frameSd).toFixed(1) : null,
    longFrames: p.longFrames,
    delayMed: p.delays.length ? +median(p.delays).toFixed(1) : null,
    firstAt: p.firstAt, joinAt: p.joinAt,
  })).sort((a, b) => String(a.room).localeCompare(String(b.room), 'th') || a.no - b.no);
}

/* ---------- วาดโน้ต (บรรทัดเดียว) — คืน SVG เป็นข้อความ ---------- */
export function sylOf(it) {
  const M = model(it), N = M.notes, out = N.map(() => '');
  N.forEach((x, i) => {
    if (x.rest) return;
    if (x.tiedFrom) { out[i] = 'อา'; return; }
    out[i] = { w: 'ทา-อา-อา-อา', h: x.dot ? 'ทา-อา-อา' : 'ทา-อา', q: x.dot ? 'ทัม' : 'ทา', e: 'ที' }[x.d];
  });
  return out;
}
export function renderNota(it, o = {}) {
  const M = model(it), bpr = o.bpr || 2, W = 344, L = 6, TS = 22, R = 6, syl = o.syl ? sylOf(it) : null;
  const RH = 56 + (syl ? 16 : 0), rows = Math.ceil(M.bars / bpr), barW = (W - L - TS - R) / bpr;
  const Y = (r) => r * RH + 34;
  const wt = (x) => 1 + 0.6 * Math.log2(x.dur / 0.5), XS = new Map(), byBar = {};
  M.notes.forEach((x) => (byBar[x.bar] = byBar[x.bar] || []).push(x));
  Object.values(byBar).forEach((arr) => {
    const tot = arr.reduce((a, x) => a + wt(x), 0); let acc = 0;
    arr.forEach((x) => { const bi = x.bar % bpr; XS.set(x, L + TS + bi * barW + 12 + acc / tot * (barW - 22)); acc += wt(x); });
  });
  let s = `<svg class="nota" viewBox="0 0 ${W} ${rows * RH + 2}" role="img" aria-label="โน้ตข้อ ${it.no}">`;
  for (let r = 0; r < rows; r++) {
    const y = Y(r), here = Math.min(bpr, M.bars - r * bpr), xEnd = L + TS + here * barW;
    s += `<line class="ln" x1="${L}" x2="${xEnd}" y1="${y}" y2="${y}"/><line class="bl" x1="${L}" x2="${L}" y1="${y - 12}" y2="${y + 12}"/>`;
    for (let b = 1; b <= here; b++) {
      const x = L + TS + b * barW; s += `<line class="bl" x1="${x}" x2="${x}" y1="${y - 12}" y2="${y + 12}"/>`;
      if (r * bpr + b === M.bars) s += `<line class="bl" style="stroke-width:3.2" x1="${x + 2.5}" x2="${x + 2.5}" y1="${y - 12}" y2="${y + 12}"/>`;
    }
    if (r === 0) s += `<text class="ts" x="${L + 10}" y="${y - 3}" text-anchor="middle">${it.ts.n}</text><text class="ts" x="${L + 10}" y="${y + 12}" text-anchor="middle">${it.ts.d}</text>`;
  }
  const col = (i) => {
    if (o.hl === i) return 'var(--pri)';
    const st = o.states && o.states[i];
    if (st === 'ok') return 'var(--ok)'; if (st === 'near') return 'var(--warn)'; if (st === 'miss') return 'var(--bad)';
    return 'currentColor';
  };
  const grp = new Array(M.notes.length).fill(-1); let gid = 0;
  for (let i = 0; i < M.notes.length;) {
    const x = M.notes[i];
    if (x.d === 'e' && !x.rest && !x.dot) {
      const key = Math.floor(x.inBar / M.beatQ + 1e-6); let j = i;
      while (j + 1 < M.notes.length) { const y = M.notes[j + 1]; if (y.d === 'e' && !y.rest && !y.dot && y.bar === x.bar && Math.floor(y.inBar / M.beatQ + 1e-6) === key) j++; else break; }
      if (j > i) { for (let k = i; k <= j; k++) grp[k] = gid; gid++; }
      i = j + 1;
    } else i++;
  }
  const P = M.notes.map((x) => ({ x: XS.get(x), r: Math.floor(x.bar / bpr) }));
  M.notes.forEach((x, i) => {
    const { x: cx, r } = P[i], y = Y(r), c = col(i);
    if (x.rest) {
      if (x.d === 'w') s += `<rect x="${cx - 6}" y="${y}" width="12" height="5" fill="${c}"/>`;
      else if (x.d === 'h') s += `<rect x="${cx - 6}" y="${y - 5}" width="12" height="5" fill="${c}"/>`;
      else if (x.d === 'q') s += `<path d="M${cx - 2} ${y - 13} l5 6 l-4 5 l5 6 c-4 -2 -7 0 -4 5" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      else s += `<circle cx="${cx - 3}" cy="${y - 6}" r="2.4" fill="${c}"/><path d="M${cx - 3} ${y - 5} q4 1 6 -3 l-4 13" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>`;
    } else {
      const hollow = x.d === 'h' || x.d === 'w';
      if (x.d === 'w') s += `<ellipse cx="${cx}" cy="${y}" rx="7" ry="4.8" fill="var(--card,#fff)" stroke="${c}" stroke-width="2.2"/>`;
      else s += `<ellipse cx="${cx}" cy="${y}" rx="6" ry="4.4" transform="rotate(-20 ${cx} ${y})" fill="${hollow ? 'var(--card,#fff)' : c}" stroke="${c}" stroke-width="${hollow ? 2 : 1}"/>`;
      if (x.dot) s += `<circle cx="${cx + 11}" cy="${y - 3}" r="1.9" fill="${c}"/>`;
      if (x.d !== 'w') {
        s += `<line x1="${cx + 5.5}" x2="${cx + 5.5}" y1="${y - 1}" y2="${y - 28}" stroke="${c}" stroke-width="1.5"/>`;
        if (x.d === 'e') {
          if (grp[i] < 0) s += `<path d="M${cx + 5.5} ${y - 28} q8 6 6 16" fill="none" stroke="${c}" stroke-width="1.8"/>`;
          else if (grp[i - 1] !== grp[i]) { let j = i; while (grp[j + 1] === grp[i]) j++; s += `<line x1="${cx + 4.8}" x2="${P[j].x + 6.2}" y1="${y - 26}" y2="${y - 26}" stroke="currentColor" stroke-width="4.5"/>`; }
        }
      }
    }
    if (syl && syl[i]) s += `<text class="syl" x="${cx}" y="${r * RH + RH - 6}" text-anchor="middle">${syl[i]}</text>`;
  });
  return s + '</svg>';
}
