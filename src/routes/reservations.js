const express = require('express');
const router = express.Router();
const { getDb } = require('../config/firebase');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../controllers/auditController');
const { checkConflict } = require('../controllers/reservationController');
const QRCode = require('qrcode');

router.get('/', authenticate, async (req, res) => {
  try {
    const db = getDb();
    let query = db.collection('reservations');
    if (req.query.startDate) query = query.where('date', '>=', req.query.startDate);
    if (req.query.endDate) query = query.where('date', '<=', req.query.endDate);
    const snapshot = await query.orderBy('date').orderBy('startTime').get();
    res.json(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (error) { res.status(500).json({ error: 'Error al obtener reservas' }); }
});

router.post('/', authenticate, authorize('admin', 'operator'), async (req, res) => {
  const { eventName, responsible, contact, spaceId, date, startTime, endTime, notes } = req.body;
  if (!eventName || !responsible || !contact || !spaceId || !date || !startTime || !endTime)
    return res.status(400).json({ error: 'Todos los campos obligatorios deben estar completos' });
  if (startTime >= endTime) return res.status(400).json({ error: 'La hora de inicio debe ser anterior a la hora de finalizacion' });
  try {
    const db = getDb();
    const blockedSnap = await db.collection('blockedDates').where('date', '==', date).limit(1).get();
    if (!blockedSnap.empty) return res.status(409).json({ error: 'La fecha ' + date + ' esta bloqueada: ' + blockedSnap.docs[0].data().reason });
    const conflict = await checkConflict(db, { spaceId, date, startTime, endTime });
    if (conflict) return res.status(409).json({ error: 'Conflicto de horario: ya existe una reserva de ' + conflict.startTime + ' a ' + conflict.endTime + ' para ' + conflict.eventName });
    const confirmationCode = 'CC-' + Date.now().toString(36).toUpperCase();
    const newReservation = { eventName, responsible, contact, spaceId, date, startTime, endTime, notes: notes || '', confirmationCode, status: 'confirmed', createdAt: new Date().toISOString(), createdBy: req.user.uid, createdByName: req.user.name };
    const docRef = await db.collection('reservations').add(newReservation);
    const qrData = 'Casa de Cultura Ipiales\nCodigo: ' + confirmationCode + '\nEvento: ' + eventName + '\nFecha: ' + date + '\nHora: ' + startTime + ' - ' + endTime + '\nResponsable: ' + responsible;
    const qrCode = await QRCode.toDataURL(qrData);
    await logAudit(db, { action: 'CREATE_RESERVATION', targetId: docRef.id, targetType: 'reservation', details: { eventName, date, spaceId, startTime, endTime }, performedBy: req.user });
    res.status(201).json({ id: docRef.id, ...newReservation, qrCode });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error al crear reserva' }); }
});

router.put('/:id', authenticate, authorize('admin', 'operator'), async (req, res) => {
  const { eventName, responsible, contact, spaceId, date, startTime, endTime, notes } = req.body;
  const { id } = req.params;
  if (startTime >= endTime) return res.status(400).json({ error: 'La hora de inicio debe ser anterior a la hora de finalizacion' });
  try {
    const db = getDb();
    const resRef = db.collection('reservations').doc(id);
    const resDoc = await resRef.get();
    if (!resDoc.exists) return res.status(404).json({ error: 'Reserva no encontrada' });
    const blockedSnap = await db.collection('blockedDates').where('date', '==', date).limit(1).get();
    if (!blockedSnap.empty) return res.status(409).json({ error: 'La fecha ' + date + ' esta bloqueada' });
    const conflict = await checkConflict(db, { spaceId, date, startTime, endTime, excludeId: id });
    if (conflict) return res.status(409).json({ error: 'Conflicto de horario: ya existe una reserva de ' + conflict.startTime + ' a ' + conflict.endTime + ' para ' + conflict.eventName });
    const updates = { eventName, responsible, contact, spaceId, date, startTime, endTime, notes: notes || '', updatedAt: new Date().toISOString(), updatedBy: req.user.uid, updatedByName: req.user.name };
    await resRef.update(updates);
    await logAudit(db, { action: 'UPDATE_RESERVATION', targetId: id, targetType: 'reservation', details: { eventName, date, spaceId, startTime, endTime }, performedBy: req.user });
    res.json({ message: 'Reserva actualizada' });
  } catch (error) { res.status(500).json({ error: 'Error al actualizar reserva' }); }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    const resDoc = await db.collection('reservations').doc(id).get();
    if (!resDoc.exists) return res.status(404).json({ error: 'Reserva no encontrada' });
    const resData = resDoc.data();
    await db.collection('reservations').doc(id).delete();
    await logAudit(db, { action: 'DELETE_RESERVATION', targetId: id, targetType: 'reservation', details: { eventName: resData.eventName, date: resData.date }, performedBy: req.user });
    res.json({ message: 'Reserva eliminada' });
  } catch (error) { res.status(500).json({ error: 'Error al eliminar reserva' }); }
});

module.exports = router;
