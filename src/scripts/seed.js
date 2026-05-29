require('dotenv').config();
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('../../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function seed() {
  console.log('Iniciando carga de datos de prueba...');

  const users = [
    { email: 'admin@casacultura.gov.co', name: 'Administrador Principal', role: 'admin', password: 'admin123' },
    { email: 'operador@casacultura.gov.co', name: 'Maria Gonzalez', role: 'operator', password: 'oper123' },
  ];

  const userIds = {};
  for (const user of users) {
    const existing = await db.collection('users').where('email', '==', user.email).limit(1).get();
    if (!existing.empty) { userIds[user.email] = existing.docs[0].id; console.log('Usuario ya existe: ' + user.email); continue; }
    const passwordHash = await bcrypt.hash(user.password, 12);
    const docRef = await db.collection('users').add({ email: user.email, name: user.name, role: user.role, passwordHash, active: true, createdAt: new Date().toISOString() });
    userIds[user.email] = docRef.id;
    console.log('Usuario creado: ' + user.name + ' / contrasena: ' + user.password);
  }

  const spaces = [
    { name: 'Biblioteca primer piso', description: 'Sala de lectura', color: '#1a56db', capacity: 40 },
    { name: 'Biblioteca segundo piso', description: 'Sala de estudios', color: '#7e3af2', capacity: 30 },
    { name: 'Patio principal', description: 'Espacio abierto', color: '#057a55', capacity: 200 },
    { name: 'Teatro', description: 'Auditorio principal', color: '#e02424', capacity: 150 },
    { name: 'Salon de musica', description: 'Sala insonorizada', color: '#d97706', capacity: 25 },
    { name: 'Salon de musica segundo piso', description: 'Sala adicional', color: '#0694a2', capacity: 20 },
    { name: 'Sala de exposiciones', description: 'Galeria de arte', color: '#e74694', capacity: 60 },
  ];

  const spaceIds = {};
  for (const space of spaces) {
    const existing = await db.collection('spaces').where('name', '==', space.name).limit(1).get();
    if (!existing.empty) { spaceIds[space.name] = existing.docs[0].id; console.log('Espacio ya existe: ' + space.name); continue; }
    const docRef = await db.collection('spaces').add({ ...space, active: true, createdAt: new Date().toISOString(), createdBy: userIds['admin@casacultura.gov.co'] });
    spaceIds[space.name] = docRef.id;
    console.log('Espacio creado: ' + space.name);
  }

  console.log('');
  console.log('===================================');
  console.log('DATOS CARGADOS EXITOSAMENTE');
  console.log('===================================');
  console.log('Administrador:');
  console.log('  Email:    admin@casacultura.gov.co');
  console.log('  Password: admin123');
  console.log('Operador:');
  console.log('  Email:    operador@casacultura.gov.co');
  console.log('  Password: oper123');
  console.log('===================================');
  process.exit(0);
}

seed().catch(err => { console.error('Error en seed:', err); process.exit(1); });
