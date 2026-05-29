const admin = require('firebase-admin');

let db;

function initializeFirebase() {
  if (!admin.apps.length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : require('../../serviceAccountKey.json');

    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('Firebase inicializado correctamente');
  }
  db = admin.firestore();
  return db;
}

function getDb() {
  if (!db) db = admin.firestore();
  return db;
}

module.exports = { initializeFirebase, getDb, admin };
