const express = require('express');
const router = express.Router();
const { getDb } = require('../config/firebase');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../controllers/auditController');

router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const snapshot = await db.collection('blockedDates').orderBy('date').get();
    res.json(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (error) { res.status(500).json({ error: 'Error al obtener fechas bloqueadas' }); }
});

router.post('/', authenticate, authorize('admin'), async (req, res) => {
  const { date, reason } = req.body;
  if (!date) return res.status(400).json({ error: 'La fecha es requerida' });
  try {
    const db = getDb();
    const docRef = await db.collection('blockedDates').add({ date, reason: reason || 'Fecha bloqueada', createdAt: new Date().toISOString(), createdBy: req.user.uid });
    await logAudit(db, { action: 'BLOCK_DATE', targetId: docRef.id, targetType: 'blockedDate', details: { date, reason }, performedBy: req.user });
    res.status(201).json({ id: docRef.id, date, reason });
  } catch (error) { res.status(500).json({ error: 'Error al bloquear fecha' }); }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const db = getDb();
    await db.collection('blockedDates').doc(req.params.id).delete();
    await logAudit(db, { action: 'UNBLOCK_DATE', targetId: req.params.id, targetType: 'blockedDate', details: {}, performedBy: req.user });
    res.json({ message: 'Fecha desbloqueada' });
  } catch (error) { res.status(500).json({ error: 'Error al desbloquear fecha' }); }
});

module.exports = router;
