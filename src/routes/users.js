const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../config/firebase');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../controllers/auditController');

router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const db = getDb();
    const snapshot = await db.collection('users').orderBy('name').get();
    const users = snapshot.docs.map(d => { const { passwordHash, ...safe } = d.data(); return { uid: d.id, ...safe }; });
    res.json(users);
  } catch (error) { res.status(500).json({ error: 'Error al obtener usuarios' }); }
});

router.post('/', authenticate, authorize('admin'), async (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name || !role) return res.status(400).json({ error: 'Todos los campos son requeridos' });
  if (!['admin', 'operator'].includes(role)) return res.status(400).json({ error: 'Rol invalido' });
  if (password.length < 6) return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres' });
  try {
    const db = getDb();
    const existing = await db.collection('users').where('email', '==', email.toLowerCase()).limit(1).get();
    if (!existing.empty) return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = { email: email.toLowerCase(), passwordHash, name, role, active: true, createdAt: new Date().toISOString(), createdBy: req.user.uid };
    const docRef = await db.collection('users').add(newUser);
    await logAudit(db, { action: 'CREATE_USER', targetId: docRef.id, targetType: 'user', details: { email: newUser.email, name, role }, performedBy: req.user });
    const { passwordHash: _, ...safeUser } = newUser;
    res.status(201).json({ uid: docRef.id, ...safeUser });
  } catch (error) { res.status(500).json({ error: 'Error al crear usuario' }); }
});

router.put('/:uid', authenticate, authorize('admin'), async (req, res) => {
  const { name, role, active, password } = req.body;
  const { uid } = req.params;
  try {
    const db = getDb();
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Usuario no encontrado' });
    const updates = { name, role, active };
    if (password && password.length >= 6) updates.passwordHash = await bcrypt.hash(password, 12);
    await userRef.update(updates);
    await logAudit(db, { action: 'UPDATE_USER', targetId: uid, targetType: 'user', details: { name, role, active }, performedBy: req.user });
    res.json({ message: 'Usuario actualizado' });
  } catch (error) { res.status(500).json({ error: 'Error al actualizar usuario' }); }
});

router.delete('/:uid', authenticate, authorize('admin'), async (req, res) => {
  const { uid } = req.params;
  if (uid === req.user.uid) return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
  try {
    const db = getDb();
    await db.collection('users').doc(uid).delete();
    await logAudit(db, { action: 'DELETE_USER', targetId: uid, targetType: 'user', details: {}, performedBy: req.user });
    res.json({ message: 'Usuario eliminado' });
  } catch (error) { res.status(500).json({ error: 'Error al eliminar usuario' }); }
});

module.exports = router;
