// ย่อรูปในมือถือก่อนส่ง (ด้านยาวไม่เกิน 1600px, JPEG)
export const MAX_B64 = 2000000;

export function fitSize(w, h, max = 1600) {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

async function decode(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* ลองอีกทาง */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

/** File → {mime:'image/jpeg', data: base64 ไม่มีหัว data:} */
export async function toJpegBase64(file, max = 1600, quality = 0.8) {
  const img = await decode(file);
  const { w, h } = fitSize(img.width, img.height, max);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  if (img.close) img.close();
  let q = quality, data;
  for (;;) {
    data = c.toDataURL('image/jpeg', q).split(',')[1];
    if (data.length <= MAX_B64 || q <= 0.5) break;
    q = Math.round((q - 0.1) * 10) / 10;
  }
  if (data.length > MAX_B64) throw new Error('รูปใหญ่เกินไป ลองถ่ายใหม่ให้ใกล้ขึ้น');
  return { mime: 'image/jpeg', data };
}
