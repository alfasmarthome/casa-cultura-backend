const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const { getDb } = require('../config/firebase');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/export', authenticate, authorize('admin', 'operator'), async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'Se requiere startDate y endDate' });
  try {
    const db = getDb();
    const resSnapshot = await db.collection('reservations').where('date', '>=', startDate).where('date', '<=', endDate).orderBy('date').orderBy('startTime').get();
    const spacesSnapshot = await db.collection('spaces').get();
    const spacesMap = {};
    spacesSnapshot.docs.forEach(d => { spacesMap[d.id] = d.data().name; });
    const rows = resSnapshot.docs.map(d => {
      const r = d.data();
      return { 'Codigo': r.confirmationCode || '', 'Evento': r.eventName, 'Responsable': r.responsible, 'Contacto': r.contact, 'Espacio': spacesMap[r.spaceId] || r.spaceId, 'Fecha': r.date, 'Hora inicio': r.startTime, 'Hora fin': r.endTime, 'Notas': r.notes || '', 'Creado por': r.createdByName || '' };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reservas');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=reservas_' + startDate + '_' + endDate + '.xlsx');
    res.send(buffer);
  } catch (error) { res.status(500).json({ error: 'Error al generar reporte' }); }
});

router.get('/monthly', authenticate, authorize('admin', 'operator'), async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: 'Se requiere year y month' });
  const startDate = year + '-' + month.padStart(2, '0') + '-01';
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = year + '-' + month.padStart(2, '0') + '-' + lastDay;
  try {
    const db = getDb();
    const resSnapshot = await db.collection('reservations').where('date', '>=', startDate).where('date', '<=', endDate).get();
    const spacesSnapshot = await db.collection('spaces').get();
    const spacesMap = {};
    spacesSnapshot.docs.forEach(d => { spacesMap[d.id] = d.data().name; });
    const summary = {};
    resSnapshot.docs.forEach(d => {
      const r = d.data();
      const spaceName = spacesMap[r.spaceId] || 'Desconocido';
      if (!summary[spaceName]) summary[spaceName] = 0;
      summary[spaceName]++;
    });
    res.json({ period: year + '-' + month, total: resSnapshot.size, bySpace: summary });
  } catch (error) { res.status(500).json({ error: 'Error al generar resumen mensual' }); }
});

module.exports = router;
