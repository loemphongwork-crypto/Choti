// คิวงานที่ต้องส่งขึ้นระบบ: เก็บในเครื่องก่อน ส่งตามลำดับเมื่อเน็ตใช้ได้
const KEY = 'q:v1';

export function createQueue(storage, send, onError) {
  const read = () => { try { return JSON.parse(storage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  const write = (items) => { try { storage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* เต็ม/ส่วนตัว */ } };
  let running = null;
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn(read().length));

  function push(op) {
    const item = { name: op.name, args: Object.assign({}, op.args, { clientTime: Date.now() }) };
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
      const rest = read();
      rest.shift();
      write(rest);
      notify();
    }
  }

  function flush() {
    if (!running) running = run().finally(() => { running = null; });
    return running;
  }

  return { push, flush, pending: () => read().length, onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); } };
}
