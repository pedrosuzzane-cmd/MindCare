/**
 * One-off migration: relabel legacy UC students who chose the Architecture
 * program under the old "College of Engineering and Architecture (CEA)"
 * department so they belong to the new "College of Architecture and Fine Arts
 * (CAFA)" department.
 *
 * Legacy CEA engineering students are intentionally left untouched — the
 * analytics layer maps their stored "(CEA)" code onto COE via
 * DEPARTMENT_CODE_ALIASES.
 *
 * Usage (from the backend directory):
 *   node migrate-cafa.js            # performs the update
 *   node migrate-cafa.js --dry-run  # only reports what would change
 */
const dotenv = require("dotenv");
dotenv.config();

let admin;
try {
  admin = require("firebase-admin");
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    serviceAccount = require(
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./service-account.json",
    );
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: "mindcare-8801e",
    });
  }
} catch (err) {
  console.error("Firebase Admin initialization failed:", err.message);
  process.exit(1);
}

const LEGACY_CEA_DEPARTMENT = "College of Engineering and Architecture (CEA)";
const CAFA_DEPARTMENT = "College of Architecture and Fine Arts (CAFA)";

const DRY_RUN = process.argv.includes("--dry-run");

async function run() {
  const db = admin.firestore();
  const usersRef = db.collection("users");

  const matched = [];
  let scanned = 0;

  const snapshot = await usersRef
    .where("role", "==", "student")
    .orderBy("createdAt")
    .get();

  for (const doc of snapshot.docs) {
    scanned += 1;
    const data = doc.data();
    const dept = String(data.department || "");
    const program = String(data.academicProgram || "");

    const isLegacyCEA =
      dept.includes("Engineering and Architecture (CEA)") ||
      dept === LEGACY_CEA_DEPARTMENT;
    const isArchitecture = /architecture/i.test(program);

    if (isLegacyCEA && isArchitecture) {
      matched.push({
        uid: doc.id,
        fullName: data.fullName || "?",
        department: dept,
        academicProgram: program,
      });
    }
  }

  console.log(`Scanned ${scanned} student profiles.`);
  console.log(`Architecture students under legacy CEA: ${matched.length}`);
  matched.forEach((m) =>
    console.log(`  - ${m.fullName} (${m.uid}): ${m.academicProgram}`),
  );

  if (DRY_RUN) {
    console.log("\nDry run — no changes written.");
    return;
  }

  if (matched.length === 0) {
    console.log("\nNothing to update.");
    return;
  }

  const batch = db.batch();
  matched.forEach((m) => {
    batch.update(usersRef.doc(m.uid), { department: CAFA_DEPARTMENT });
  });
  await batch.commit();

  console.log(
    `\nUpdated ${matched.length} students to "${CAFA_DEPARTMENT}".`,
  );
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
