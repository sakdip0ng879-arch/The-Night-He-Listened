/* png1.js — เขียน PNG ขาวดำ 1 บิต จาก mask (ไม่มี dependency)
 *
 * ทำไมต้องมี: เราต้องส่ง "ลายฉลุน้ำ" ของแผ่นให้เบราว์เซอร์แบบ **ไม่แปลงรูปมันเลย**
 * PNG 1 บิตคือรูปแบบที่เล็กที่สุดที่ทำได้ · Node มี zlib อยู่แล้ว จึงไม่ต้องพึ่งไลบรารีใคร
 *
 * ขาว (1) = มีของ · ดำ (0) = ว่าง — ใช้เป็น luminance mask ของ SVG ได้ตรง ๆ
 */
const zlib = require('zlib');

function crc32(buf){
  let c, table = crc32.t;
  if (!table){
    table = crc32.t = new Int32Array(256);
    for (let n = 0; n < 256; n++){
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data){
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/* mask = Uint8Array ขนาด W*H (0/1) */
function writePng1(W, H, mask){
  const rowBytes = (W + 7) >> 3;
  const raw = Buffer.alloc((rowBytes + 1) * H);
  for (let y = 0; y < H; y++){
    const off = y * (rowBytes + 1);
    raw[off] = 0;                                  /* filter type 0 */
    const row = y * W;
    for (let x = 0; x < W; x++)
      if (mask[row + x]) raw[off + 1 + (x >> 3)] |= 0x80 >> (x & 7);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 1;      /* bit depth 1 */
  ihdr[9] = 0;      /* colour type 0 = greyscale */
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}
module.exports = { writePng1 };
