import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const logo=(await readFile(path.join(root,'site/img/logo-fed.png'))).toString('base64');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#111d37"/><rect x="0" y="0" width="14" height="630" fill="#bc202b"/><rect x="806" y="0" width="394" height="630" fill="#f5f4f0"/><image href="data:image/png;base64,${logo}" x="845" y="125" width="305" height="305" preserveAspectRatio="xMidYMid meet"/><g fill="#ffffff" font-family="DejaVu Sans, Arial, sans-serif" font-weight="700"><text x="70" y="173" font-size="51">ФЕДЕРАЦИЯ</text><text x="70" y="250" font-size="51">КИКБОКСИНГА</text><text x="70" y="324" font-size="36">РЕСПУБЛИКИ ХАКАСИЯ</text></g><rect x="70" y="374" width="108" height="6" rx="3" fill="#bc202b"/><text x="70" y="455" fill="#d6e1ef" font-family="DejaVu Sans, Arial, sans-serif" font-size="24">Люди · Соревнования · История</text><text x="70" y="550" fill="#ffffff" font-family="DejaVu Sans, Arial, sans-serif" font-size="30">kickboxing19.ru</text></svg>`;
await sharp(Buffer.from(svg)).png().toFile(path.join(root,'site/img/seo-share.png'));
console.log('Готово: site/img/seo-share.png (1200 × 630)');
