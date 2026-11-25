// Las pruebas que escriben datos solo se habilitan contra Firestore Emulator.
const habilitada = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.TEST_FIREBASE_PROJECT_ID);

if (habilitada) {
  process.env.DATA_BACKEND = "firestore";
  process.env.FIREBASE_PROJECT_ID = process.env.TEST_FIREBASE_PROJECT_ID;
  process.env.JWT_SECRET = process.env.TEST_JWT_SECRET || "firestore-emulator-only-jwt-secret";
  process.env.VERCEL = "1";
}

module.exports = habilitada;
