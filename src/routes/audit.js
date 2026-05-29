const express = require('express');
const router = express.Router();
const { getDb } = require('../config/firebase');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('admin', 'operator'), async (req, res) => {
  try {
    const db = getDb();
    let query = db.collection('auditLog').orderBy('timestamp', 'desc').limit(200);
    const snapshot = await query.get();
    res.json(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (error) { res.status(500).json({ error: 'Error al obtener historial' }); }
});

module.exports = router;
