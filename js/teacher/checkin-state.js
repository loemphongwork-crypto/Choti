// กติกาการแตะการ์ดเช็คชื่อ (ไม่แตะ DOM)
export const LABEL = { P: 'มา', L: 'สาย 1', M: 'สาย 2', S: 'ลา', B: 'ลา', E: 'กิจกรรม', A: 'ขาด', '': '' };

export function phaseOf(session) {
  return session && session.onTimeEndAt ? 'after' : 'round1';
}

/** ผลของการแตะการ์ด 1 ครั้ง · null = ไม่ทำอะไร (การ์ดเช็คแล้ว ให้แก้ด้วยกดค้าง) */
export function tapAction(card, phase, halfPassed, lateMode) {
  if (card.status) return null;
  if (halfPassed) return { status: 'P', half: true };
  if (phase === 'round1') return { status: 'P' };
  return { status: lateMode === 'M' ? 'M' : 'L' }; // หลังรอบแรก: แตะเดียว ตามปุ่มสลับ สาย 1 / สาย 2
}

const TONES = /[่-์ั็]/g; // วรรณยุกต์ + ไม้หันอากาศ/ไม้ไต่คู้ ไม่ต้องพิมพ์ถูกเป๊ะ
const norm = (s) => String(s || '').replace(TONES, '').toLowerCase();

/** ค้นหาอัจฉริยะ: ตัวเลข = เลขที่ · ตัวอักษร = ต้นชื่อเล่น/ชื่อ/นามสกุล */
export function matchStudent(st, q) {
  q = String(q || '').trim();
  if (!q) return true;
  if (/^\d+$/.test(q)) return String(st.no) === q;
  const k = norm(q);
  return [st.nick, st.firstName, st.lastName].some((x) => norm(x).startsWith(k));
}

/** หมายเหตุที่จะส่งจากเมนูกดค้าง: ว่าง = ให้ระบบใส่เอง (เช่น มาเกินครึ่งคาบ) · ลบหมายเหตุเดิม = ส่งว่าง */
export function noteArg(typed, current) {
  const t = String(typed || '').trim();
  if (t) return t;
  return current ? '' : undefined;
}

export function countStatuses(rows, total) {
  const c = { P: 0, L: 0, M: 0, S: 0, E: 0, A: 0, none: 0 };
  let checked = 0;
  for (const r of rows) {
    const s = r.status === 'B' ? 'S' : r.status;
    if (s && s in c) { c[s]++; checked++; }
  }
  c.none = Math.max(0, total - checked);
  return c;
}
