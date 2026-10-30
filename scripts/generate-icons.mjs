import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, content) {
  const label = Buffer.from(type);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(content.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([label, content])));
  return Buffer.concat([size, label, content, crc]);
}
function distance(x, y, ax, ay, bx, by) {
  const t = Math.max(
    0,
    Math.min(
      1,
      ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) /
        ((bx - ax) ** 2 + (by - ay) ** 2),
    ),
  );
  return Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay));
}
for (const [size, name] of [
  [192, "icon-192.png"],
  [512, "icon-512.png"],
  [180, "apple-touch-icon.png"],
]) {
  const pixels = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const rgb = [0, 0, 0];
      for (let sy = 0; sy < 2; sy++)
        for (let sx = 0; sx < 2; sx++) {
          const px = ((x + (sx + 0.5) / 2) * 512) / size,
            py = ((y + (sy + 0.5) / 2) * 512) / size;
          const color =
            Math.min(
              distance(px, py, 172, 176, 342, 176),
              distance(px, py, 342, 176, 232, 350),
            ) < 17.5
              ? [255, 255, 255]
              : Math.hypot(px - 341, py - 342) < 19
                ? [217, 228, 216]
                : [73, 107, 155];
          color.forEach((v, i) => (rgb[i] += v / 4));
        }
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      rgb.forEach((v, i) => (pixels[offset + i] = Math.round(v)));
      pixels[offset + 3] = 255;
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  writeFileSync(
    new URL(`../public/${name}`, import.meta.url),
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(pixels)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
