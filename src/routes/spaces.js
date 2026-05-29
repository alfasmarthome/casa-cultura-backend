const express = require('express');
const router = express.Router();
const { getDb } = require('../config/firebase');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../controllers/auditController');

router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const snapshot = await db.collection('spaces').where('active', '==', true).get();
    const spaces = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name));
    res.json(spaces);
  } catch (error) {
    console.error('Error espacios:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticate, authorize('admin'), async (req, res) => {
  const { name, description, color, capacity } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre del espacio es requerido' });
  try {
    const db = getDb();
    const newSpace = { name, description: description || '', color: color || '#1a56db', capacity: capacity || null, active: true, createdAt: new Date().toISOString(), createdBy: req.user.uid };
    const docRef = await db.collection('spaces').add(newSpace);
    await logAudit(db, { action: 'CREATE_SPACE', targetId: docRef.id, targetType: 'space', details: { name }, performedBy: req.user });
    res.status(201).json({ id: docRef.id, ...newSpace });
  } catch (error) { console.error(error); res.status(500).json({ error: error.message }); }
});

router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  const { name, description, color, capacity, active } = req.body;
  const { id } = req.params;
  try {
    const db = getDb();
    const spaceRef = db.collection('spaces').doc(id);
    const spaceDoc = await spaceRef.get();
    if (!spaceDoc.exists) return res.status(404).json({ error: 'Espacio no encontrado' });
    const updates = { name, description, color, capacity, active };
    Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);
    await spaceRef.update(updates);
    await logAudit(db, { action: 'UPDATE_SPACE', targetId: id, targetType: 'space', details: updates, performedBy: req.user });
    res.json({ message: 'Espacio actualizado' });
  } catch (error) { console.error(error); res.status(500).json({ error: error.message }); }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    const now = new Date().toISOString().split('T')[0];
    const reservations = await db.collection('reservations').where('spaceId', '==', id).where('date', '>=', now).limit(1).get();
    if (!reservations.empty) return res.status(400).json({ error: 'No se puede eliminar un espacio con reservas futuras' });
    await db.collection('spaces').doc(id).update({ active: false });
    await logAudit(db, { action: 'DELETE_SPACE', targetId: id, targetType: 'space', details: {}, performedBy: req.user });
    res.json({ message: 'Espacio eliminado' });
  } catch (error) { console.error(error); res.status(500).json({ error: error.message }); }
});

module.exports = router;