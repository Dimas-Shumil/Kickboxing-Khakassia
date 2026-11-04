import 'dotenv/config';
import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import prisma from '../lib/prisma.js';
import {hashPassword} from '../services/password.service.js';

async function credentials() {
  // Explicit opt-in for automation; ordinary use always asks in the console.
  if (process.argv.includes('--env')) return {
    login: String(process.env.ADMIN_LOGIN || '').trim().toLowerCase(),
    password: String(process.env.ADMIN_PASSWORD || ''),
    name: String(process.env.ADMIN_NAME || '').trim(),
    role: process.env.ADMIN_ROLE || 'OWNER',
  };
  if (!process.stdin.isTTY) throw Error('Откройте обычный терминал и выполните npm run user:create.');
  let hidden = false;
  const output = new Writable({write(chunk, encoding, done) {
    if (!hidden) process.stdout.write(chunk, encoding);
    done();
  }});
  const rl = createInterface({input: process.stdin, output, terminal: true});
  rl.on('SIGINT', () => { rl.close(); });
  const askSecret = async prompt => {
    process.stdout.write(prompt);
    hidden = true;
    try { return await rl.question(''); }
    finally { hidden = false; process.stdout.write('\n'); }
  };
  try {
    console.log('Создание владельца Федерации. Пароль при вводе не отображается.');
    const name = (await rl.question('Имя: ')).trim();
    const login = (await rl.question('Логин: ')).trim().toLowerCase();
    const password = await askSecret('Пароль (от 12 символов): ');
    const confirmation = await askSecret('Подтвердите пароль: ');
    if (password !== confirmation) throw Error('Пароли не совпадают. Пользователь не создан.');
    return {name, login, password, role: 'OWNER'};
  } finally { rl.close(); }
}

async function main() {
  const {login, password, name, role} = await credentials();
  if (!/^[a-z0-9._-]{3,100}$/.test(login)) throw Error('Логин: 3–100 символов латиницы, цифр, ._-');
  if (password.length < 12 || password.length > 256) throw Error('Пароль должен содержать от 12 до 256 символов.');
  if (!name || name.length > 180) throw Error('Имя: от 1 до 180 символов.');
  if (!['OWNER', 'EDITOR'].includes(role)) throw Error('Роль: OWNER или EDITOR.');
  const existing = await prisma.admin.findUnique({where: {login}});
  if (existing && !process.argv.includes('--env')) throw Error('Этот логин уже занят. Выберите другой. Существующий пароль не изменён.');
  if (existing && existing.role !== role) throw Error('Изменение роли этой командой не выполняется.');
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async tx => {
    const admin = await tx.admin.upsert({where: {login}, create: {login, name, role, passwordHash}, update: {passwordHash, name}});
    if (existing) await tx.adminSession.deleteMany({where: {adminId: admin.id}});
  });
  console.log(`Владелец/сотрудник готов: ${login} (${role}). Вход: /admin`);
}
main().catch(error => { console.error('Ошибка создания пользователя:', error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
