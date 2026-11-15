// ครูเข้าระบบ (ครั้งแรก = ตั้งรหัสผ่าน)
import { call, store } from '../api.js';
import { h, errorBox } from '../ui.js';

export async function render(app) {
  const st = await call('teacherStatus', {});
  const pw = h('input', { type: 'password', autocomplete: 'current-password', placeholder: st.hasPassword ? 'รหัสผ่านครู' : 'ตั้งรหัสผ่านใหม่ (อย่างน้อย 4 ตัว)' });
  const err = h('div');
  const btn = h('button', { class: 'btn pri big', type: 'submit' }, st.hasPassword ? 'เข้าระบบ' : 'ตั้งรหัสและเข้าระบบ');
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      btn.disabled = true; err.replaceChildren();
      try {
        const r = await call('teacherLogin', { password: pw.value });
        store.set('tTok', r.token);
        if (!location.hash.startsWith('#/t')) location.hash = '#/t';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch (x) { err.replaceChildren(errorBox(x)); btn.disabled = false; }
    },
  }, h('label', { class: 'field' }, h('span', {}, 'รหัสผ่าน'), pw), err, btn);
  app.append(
    h('div', { class: 's-hd' }, h('small', {}, 'ระบบวิชาเรียน'), h('b', {}, 'สำหรับครู')),
    h('div', { class: 's-body' }, h('div', { class: 's-card' }, form)));
  pw.focus();
}
