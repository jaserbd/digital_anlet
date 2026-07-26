// Side-effect import guarantees `.env` is loaded (and validated) before PrismaClient reads
// DATABASE_URL, regardless of which module imports `prisma` first.
import '../config/env';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
