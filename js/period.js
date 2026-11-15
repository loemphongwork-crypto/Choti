// เวลาคาบ (คิดเป็นเวลาไทยเสมอ ไม่ขึ้นกับเขตเวลาของเครื่อง)
const H7 = 7 * 3600000;

export function halfPassed(startAt, minutes, now) {
  return now > startAt + minutes * 30000;
}

export function fmtClock(ms) {
  return new Date(ms + H7).toISOString().slice(11, 16);
}

const mmss = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};
/** เวลาวิ่งบนหัวจอ: ผ่านไปตั้งแต่กดเริ่ม / เหลือถึงเวลาจบ / เลยเวลาจบ (นาที:วินาที) */
export function elapsed(startAt, endAt, now) {
  const passed = Math.max(0, now - startAt);
  return { passed: mmss(passed), left: now <= endAt ? mmss(endAt - Math.max(now, startAt)) : null, over: now > endAt ? mmss(now - endAt) : null };
}

/** เวลาจบคาบของคาบนี้ (คาบเก่าที่ไม่มี planEndAt คิดจากความยาว) */
export function endOf(s) { return s.planEndAt || (s.startAt + (s.periodMinutes || 50) * 60000); }
/** จุดครึ่งคาบ: กลางคาบตามตาราง · ไม่มีตาราง = กลางระหว่างเวลากดเริ่มกับเวลาจบ */
export function halfAt(s) { return ((s.planStartAt ?? s.startAt) + endOf(s)) / 2; }

/** "HH:MM" ในวันเดียวกับ ref (เวลาไทย) → ms · รูปแบบผิด = null */
export function clockToMs(hhmm, ref) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  const day = new Date(ref + H7).toISOString().slice(0, 10);
  return Date.parse(day + 'T00:00:00Z') - H7 + (+m[1]) * 3600000 + (+m[2]) * 60000;
}
