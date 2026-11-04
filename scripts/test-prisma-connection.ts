import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
try {
  const n = await db.category.count();
  console.log(`PRISMA_OK categories=${n}`);
} catch (e: unknown) {
  const err = e as { code?: string; message?: string };
  console.log("CODE:", err.code);
  console.log("MESSAGE:", (err.message || "").slice(0, 400));
}
await db.$disconnect();
