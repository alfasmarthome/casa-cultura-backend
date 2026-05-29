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
    const spacesSnapshot = await db.collection('spaces').get();
    const spaces = spacesSnapshot.docs.map(d => ({ id: d.id, name: d.data().name }));
    spaces.sort((a, b) => a.name.localeCompare(b.name));

    const resSnapshot = await db.collection('reservations').where('date', '>=', startDate).where('date', '<=', endDate).get();
    const reservations = resSnapshot.docs.map(d => d.data()).sort((a, b) => {
      return a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date);
    });

    const wb = XLSX.utils.book_new();

    spaces.forEach(space => {
      const spaceReservations = reservations.filter(r => r.spaceId === space.id);
      const rows = spaceReservations.map(r => ({
        'Fecha': r.date,
        'Hora inicio': r.startTime,
        'Hora fin': r.endTime,
        'Evento': r.eventName,
        'Responsable': r.responsible,
        'Contacto': r.contact,
        'Código': r.confirmationCode || ''
      }));

      const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Fecha': 'Sin reservas en este período', 'Hora inicio': '', 'Hora fin': '', 'Evento': '', 'Responsable': '', 'Contacto': '', 'Código': '' }]);
      
      // Ancho de columnas
      ws['!cols'] = [
        { wch: 12 }, // Fecha
        { wch: 10 }, // Hora inicio
        { wch: 10 }, // Hora fin
        { wch: 30 }, // Evento
        { wch: 20 }, // Responsable
        { wch: 18 }, // Contacto
        { wch: 15 }, // Código
      ];

      XLSX.utils.book_append_sheet(wb, ws, space.name.substring(0, 31));
    });

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=reservas_' + startDate + '_' + endDate + '.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar reporte' });
  }
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