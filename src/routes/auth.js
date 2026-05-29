const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../config/firebase');
const { authenticate } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contrasena requeridos' });
  try {
    const db = getDb();
    const snapshot = await db.collection('users').where('email', '==', email.toLowerCase()).where('active', '==', true).limit(1).get();
    if (snapshot.empty) return res.status(401).json({ error: 'Credenciales invalidas' });
    const userDoc = snapshot.docs[0];
    const user = userDoc.data();
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) return res.status(401).json({ error: 'Credenciales invalidas' });
    const token = jwt.sign(
      { uid: userDoc.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, user: { uid: userDoc.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error al iniciar sesion' });
  }
});

router.post('/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Datos invalidos' });
  try {
    const db = getDb();
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const user = userDoc.data();
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Contrasena actual incorrecta' });
    const hash = await bcrypt.hash(newPassword, 12);
    await db.collection('users').doc(req.user.uid).update({ passwordHash: hash });
    res.json({ message: 'Contrasena actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar contrasena' });
  }
});

module.exports = router;
