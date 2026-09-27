import "dotenv/config";
import { closeDb, getDb, users } from "../db";
import { hashPassword } from "../lib/password";

async function main() {
  const email = process.argv[2];
  const name = process.argv[3] ?? "Test User";
  const password = process.argv[4] ?? "password123";
  if (!email) throw new Error("usage: seed-user email name password");
  const db = getDb();
  const [user] = await db
    .insert(users)
    .values({ email, name, passwordHash: await hashPassword(password) })
    .returning();
  console.log(JSON.stringify({ id: user.id, email: user.email }));
}

main()
  .then(async () => {
    await closeDb();
  })
  .catch(async (e) => {
    console.error(e);
    await closeDb().catch(() => undefined);
    process.exit(1);
  });
