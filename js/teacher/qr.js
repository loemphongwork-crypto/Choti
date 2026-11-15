// QR ห้อง ให้นักเรียนสแกนเข้าระบบ (ตัวสร้าง QR โหลดจาก cdnjs ตอนใช้ครั้งแรก)
import { h, sheet, toast } from '../ui.js';

let lib;
function loadLib() {
  if (window.QRCode) return Promise.resolve();
  lib = lib || new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = res; s.onerror = () => { lib = null; rej(new Error('โหลดตัวสร้าง QR ไม่ได้ (ตรวจอินเทอร์เน็ต)')); };
    document.head.append(s);
  });
  return lib;
}

export function joinUrl(classroomId) {
  return location.origin + location.pathname + '#/join/' + encodeURIComponent(classroomId);
}

export async function showRoomQR(room) {
  const url = joinUrl(room.id);
  const box = h('div', { class: 'qr' }, h('div', { class: 'loading' }, 'กำลังสร้าง QR…'));
  sheet({
    title: `QR ห้อง ${room.name}`, sub: 'นักเรียนสแกน → แตะชื่อตัวเอง → ตั้ง PIN',
    body: box,
    foot: [h('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์แล้ว'); } catch (e) { toast(url); } } }, 'คัดลอกลิงก์')],
  });
  try {
    await loadLib();
    const el = h('div');
    // eslint-disable-next-line no-undef
    new QRCode(el, { text: url, width: 320, height: 320, correctLevel: QRCode.CorrectLevel.M });
    box.replaceChildren(el, h('div', { class: 'hint', style: 'word-break:break-all;text-align:center' }, url));
  } catch (e) { box.replaceChildren(h('div', { class: 'errmsg' }, e.message), h('div', { class: 'hint', style: 'word-break:break-all' }, url)); }
}
