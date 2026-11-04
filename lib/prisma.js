import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
const prisma=globalThis.__federationPrisma||new PrismaClient();
if(process.env.NODE_ENV!=='production')globalThis.__federationPrisma=prisma;
export default prisma;
