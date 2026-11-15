// กล่องรอส่ง: เก็บข้อมูลแต่ละรอบไว้ในเครื่องก่อน แล้วส่งเป็นชุด (Apps Script ตอบช้า ~2 วิ/คำขอ จึงไม่ส่งทุกรอบ)
// เน็ตหลุด = เก็บไว้ ส่งรอบหน้า · ระบบปฏิเสธข้อมูล (ไม่ใช่เน็ต) = ทิ้งชุดนั้น กันค้างตลอดไป
const KEY = 'mt:q';
export const BATCH = 40;

export function createOutbox(storage, send, opt = {}) {
  const gapMs = opt.gapMs ?? 20000;
  const now = opt.now || (() => Date.now());
  const read = () => { try { return JSON.parse(storage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  const write = (xs) => { try { storage.setItem(KEY, JSON.stringify(xs)); } catch (e) { /* เต็ม/โหมดส่วนตัว */ } };
  const listeners = new Set();
  let busy = false, lastSend = 0, lastErr = null;
  const state = () => ({ pending: read().length, busy, lastErr });
  const notify = () => listeners.forEach((fn) => fn(state()));

  function push(rec) { const xs = read(); xs.push(rec); write(xs); notify(); }

  /** ส่ง 1 ชุด · force = ไม่ต้องรอครบช่วงห่างขั้นต่ำ */
  async function flush(force) {
    if (busy) return false;
    const xs = read();
    if (!xs.length) return true;
    if (!force && now() - lastSend < gapMs) return false;
    busy = true; lastSend = now(); notify();
    const batch = xs.slice(0, BATCH), ids = new Set(batch.map((r) => r.clientId));
    try {
      await send(batch);
      lastErr = null;
    } catch (e) {
      lastErr = e && e.message ? e.message : String(e);
      if (e && (e.network || e.retry)) { busy = false; notify(); return false; }
    }
    write(read().filter((r) => !ids.has(r.clientId)));
    busy = false; notify();
    return true;
  }

  return { push, flush, state, pending: () => read().length, onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); } };
}
