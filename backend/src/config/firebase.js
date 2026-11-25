// Inicialización centralizada de Firebase Admin SDK.
//
// Credenciales:
//   FIREBASE_SERVICE_ACCOUNT_JSON  JSON completo de la cuenta de servicio
//                                  (también se acepta codificado en base64).
//   FIREBASE_PROJECT_ID            opcional si el JSON ya incluye project_id.
//   FIREBASE_STORAGE_BUCKET        opcional, requerido para STORAGE_DRIVER=firebase.
//
// La inicialización es perezosa: importar este módulo no exige credenciales,
// de modo que /api/health puede responder incluso si Firebase aún no está
// configurado. Cualquier acceso a datos lanza un error explícito.

const {
  initializeApp,
  getApps,
  getApp,
  cert,
} = require("firebase-admin/app");
const {
  getFirestore,
  FieldValue,
  Timestamp,
} = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

const parseServiceAccount = () => {
  const crudo = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!crudo || !crudo.trim()) {
    return null;
  }

  const texto = crudo.trim();
  let cuenta;

  try {
    cuenta = JSON.parse(texto);
  } catch {
    try {
      cuenta = JSON.parse(Buffer.from(texto, "base64").toString("utf8"));
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON no contiene un JSON válido ni base64 de un JSON"
      );
    }
  }

  if (!cuenta || typeof cuenta !== "object" || !cuenta.project_id) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON debe ser el JSON completo de una cuenta de servicio con project_id"
    );
  }

  if (typeof cuenta.private_key === "string") {
    // Vercel suele guardar los saltos de línea como \n literales.
    cuenta.private_key = cuenta.private_key.replace(/\\n/g, "\n");
  }

  return cuenta;
};

let appFirebase = null;
let dbFirestore = null;
let bucketStorage = null;

const obtenerApp = () => {
  const backend = String(process.env.DATA_BACKEND || "firestore").trim().toLowerCase();
  if (backend !== "firestore") {
    throw new Error("DATA_BACKEND debe ser 'firestore'; SQL Server ya no es un backend compatible.");
  }

  if (appFirebase) return appFirebase;

  if (getApps().length > 0) {
    appFirebase = getApp();
    return appFirebase;
  }

  const cuenta = parseServiceAccount();
  const projectId =
    process.env.FIREBASE_PROJECT_ID || cuenta?.project_id || undefined;

  if (cuenta?.project_id && projectId && cuenta.project_id !== projectId) {
    throw new Error("FIREBASE_PROJECT_ID no coincide con project_id de FIREBASE_SERVICE_ACCOUNT_JSON");
  }

  if (!cuenta && !process.env.FIRESTORE_EMULATOR_HOST && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      "Firebase no está configurado. Define FIREBASE_SERVICE_ACCOUNT_JSON y FIREBASE_PROJECT_ID en el entorno."
    );
  }

  appFirebase = cuenta
    ? initializeApp({
        credential: cert(cuenta),
        projectId,
        storageBucket:
          process.env.FIREBASE_STORAGE_BUCKET ||
          (projectId ? `${projectId}.appspot.com` : undefined),
      })
    : initializeApp({
        projectId,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
      });

  return appFirebase;
};

const obtenerDb = () => {
  if (!dbFirestore) {
    dbFirestore = getFirestore(obtenerApp());
    // Evita que valores undefined rompan escrituras accidentales.
    try {
      dbFirestore.settings({ ignoreUndefinedProperties: true });
    } catch {
      // settings solo puede llamarse antes de la primera operación.
    }
  }
  return dbFirestore;
};

const obtenerBucket = () => {
  if (!bucketStorage) {
    bucketStorage = getStorage(obtenerApp()).bucket(
      process.env.FIREBASE_STORAGE_BUCKET ||
        `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
    );
  }
  return bucketStorage;
};

const firebaseConfigurado = () =>
  Boolean(
    (String(process.env.DATA_BACKEND || "firestore").trim().toLowerCase() === "firestore") &&
    (String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim() ||
      String(process.env.FIRESTORE_EMULATOR_HOST || "").trim() ||
      String(process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim())
  );

module.exports = {
  obtenerApp,
  obtenerDb,
  obtenerBucket,
  firebaseConfigurado,
  FieldValue,
  Timestamp,
};
