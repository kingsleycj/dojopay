import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { AdminRole } from "@prisma/client";
import { assertConfigValid } from "../config/index.js";
import { connectDB, disconnectDB, prismaClient } from "../lib/prisma.js";
import { createAdmin } from "../services/admin.service.js";
import { validatePasswordStrength } from "../lib/password.js";

/**
 * Bootstrap an admin account.
 *
 * Run with `npm run admin:create`. This exists precisely so that no HTTP route
 * can create the first admin: staff access requires shell access to the
 * deployment, not merely a browser.
 *
 * The created admin cannot use the API until they complete TOTP enrolment on
 * first login, so a password leaked here is not on its own sufficient.
 */
async function main() {
  assertConfigValid();
  await connectDB();

  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    const existingOwners = await prismaClient.adminUser.count({
      where: { role: AdminRole.OWNER },
    });

    if (existingOwners > 0) {
      console.log(
        `\n⚠  ${existingOwners} OWNER admin(s) already exist.\n` +
          `   Prefer creating further admins through the admin UI so the action is attributed.\n`,
      );
      const proceed = await rl.question("Create another anyway? (y/N) ");
      if (proceed.trim().toLowerCase() !== "y") {
        console.log("Cancelled.");
        return;
      }
    }

    const email = (await rl.question("Admin email: ")).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new Error("That does not look like an email address");
    }

    const displayName = (await rl.question("Display name: ")).trim();
    if (!displayName) throw new Error("Display name is required");

    const roleAnswer = (
      await rl.question("Role [OWNER / ADMIN / ANALYST] (default OWNER): ")
    )
      .trim()
      .toUpperCase();
    const role = (roleAnswer || "OWNER") as AdminRole;
    if (!Object.values(AdminRole).includes(role)) {
      throw new Error(`Role must be one of ${Object.values(AdminRole).join(", ")}`);
    }

    // Not hidden — Node has no portable no-echo prompt without a dependency.
    // Documented rather than pretending otherwise: run this in a private
    // terminal, and clear your shell history afterwards.
    const password = await rl.question("Password (visible as you type): ");
    const weakness = validatePasswordStrength(password);
    if (weakness) throw new Error(weakness);

    const confirm = await rl.question("Confirm password: ");
    if (password !== confirm) throw new Error("Passwords do not match");

    const admin = await createAdmin({ email, password, displayName, role });

    console.log(`\n✔ Created ${admin.role} admin ${admin.email} (id ${admin.id})`);
    console.log(
      "\nNext: sign in at /admin/login. You will be asked to scan a QR code and\n" +
        "enrol an authenticator app before the account can be used.\n",
    );
  } finally {
    rl.close();
    await disconnectDB();
  }
}

main().catch((error) => {
  console.error(`\n✖ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
