// เรียก API หลังบ้าน (Apps Script doPost) แบบไม่ส่งคุกกี้บัญชี Google
export const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* โหมดส่วนตัว */ } },
};

function netError(msg) {
  const e = new Error(msg || 'เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่');
  e.network = true;
  return e;
}

/** ข้อผิดพลาดที่ส่งซ้ำแล้วน่าจะผ่าน (ระบบยุ่ง/หมดเวลา/ต้องเข้าระบบใหม่) */
export function isRetryable(msg) {
  return /^AUTH$|lock|timeout|timed out|exceed|service|server error|try again|too many|ล็อก|หมดเวลา|ลองใหม่/i.test(String(msg || ''));
}

export async function call(name, args, token, opt) {
  const url = (window.APP || {}).api;
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), (opt && opt.timeoutMs) || 30000) : null;
  let r, j;
  try {
    try {
      r = await fetch(url, {
        method: 'POST', credentials: 'omit', redirect: 'follow', signal: ctl ? ctl.signal : undefined,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ name, args: args || {}, token: token || null }),
      });
    } catch (e) { throw netError(ctl && ctl.signal.aborted ? 'ระบบตอบช้าเกินไป ลองใหม่อีกครั้ง' : undefined); }
    try { j = await r.json(); } catch (e) { throw netError('ระบบตอบกลับผิดพลาด ลองใหม่อีกครั้ง'); }
  } finally { if (timer) clearTimeout(timer); }
  if (!j.ok) {
    const e = new Error(j.error);
    if (isRetryable(j.error)) e.retry = true;
    throw e;
  }
  return j.res;
}

export function T(name, args) {
  return call(name, args, store.get('tTok')).catch((e) => {
    if (e.message === 'AUTH') { store.set('tTok', null); location.hash = '#/t'; window.dispatchEvent(new HashChangeEvent('hashchange')); }
    throw e;
  });
}

export function S(name, args) {
  return call(name, args, store.get('sTok')).catch((e) => {
    if (e.message === 'AUTH') { store.set('sTok', null); }
    throw e;
  });
}
