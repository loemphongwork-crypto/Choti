// คิวงานที่ต้องส่งขึ้นระบบ: เก็บในเครื่องก่อน ส่งตามลำดับเมื่อเน็ตใช้ได้
const KEY = 'q:v1';
// ทุกคิวในหน้าเดียวกันที่ใช้ที่เก็บเดียวกัน ส่งทีละรายการร่วมกัน (กันส่งซ้ำ/ข้ามรายการ)
const RUNNING = new WeakMap();
const LISTENERS = new WeakMap(); // ผู้ฟังร่วมของที่เก็บเดียวกัน
/** ที่เก็บในเครื่องตัวเดียวที่ทุกหน้าใช้ร่วมกัน (กันพังในโหมดส่วนตัว) */
export const LOCAL = {
  getItem: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  setItem: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* เต็ม/ส่วนตัว */ } },
  removeItem: (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
};

export function createQueue(storage, send, onError) {
  const read = () => { try { return JSON.parse(storage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  const write = (items) => { try { storage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* เต็ม/ส่วนตัว */ } };
  if (!LISTENERS.has(storage)) LISTENERS.set(storage, new Set());
  const listeners = LISTENERS.get(storage);
  const notify = () => listeners.forEach((fn) => fn(read().length));

  function push(op) {
    const item = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), name: op.name, args: Object.assign({}, op.args, { clientTime: Date.now() }) };
    const items = read();
    items.push(item);
    write(items);
    notify();
    return item;
  }

  async function run() {
    for (;;) {
      const items = read();
      if (!items.length) return;
      const op = items[0];
      try {
        await send(op);
      } catch (e) {
        if (e && (e.network || e.retry)) return; // เน็ตหลุด/ระบบยุ่ง/ต้องเข้าระบบใหม่: เก็บไว้ส่งรอบหน้า
        if (onError) onError(e, op);
      }
      write(read().filter((x) => x !== op && !(op.id && x.id === op.id) && !(!op.id && JSON.stringify(x) === JSON.stringify(op))));
      notify();
    }
  }

  function flush() {
    let r = RUNNING.get(storage);
    if (!r) { r = run().finally(() => RUNNING.delete(storage)); RUNNING.set(storage, r); }
    return r;
  }

  return { push, flush, pending: () => read().length, onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); } };
}
