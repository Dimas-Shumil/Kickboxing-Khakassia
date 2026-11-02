const path = require('node:path');
const fs = require('node:fs');
const ROOT = path.resolve(__dirname, '..');
if (fs.existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));
function config() {
  const secret = process.env.SESSION_SECRET || '';
  if (secret.length < 32) throw new Error('Нужен SESSION_SECRET длиной от 32 символов. Для новой локальной установки: npm run setup:local');
  if (!process.env.DATABASE_URL?.startsWith('file:')) throw new Error('Задайте отдельную SQLite базу DATABASE_URL=file:...');
  const origin = process.env.APP_ORIGIN || 'http://localhost:3000';
  const u = new URL(origin);
  if (!['http:', 'https:'].includes(u.protocol) || u.origin !== origin) throw new Error('APP_ORIGIN должен содержать только origin без пути.');
  const production = process.env.NODE_ENV === 'production';
  if (production && u.protocol !== 'https:') throw new Error('В production требуется APP_ORIGIN с HTTPS.');
  return {ROOT, secret, origin, production, port: Number(process.env.PORT) || 3000, host: process.env.HOST || '127.0.0.1'};
}
module.exports = {config, ROOT};
