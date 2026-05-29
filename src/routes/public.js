const express = require('express');
const router = express.Router();
const { getDb } = require('../config/firebase');

router.get('/spaces', async (req, res) => {
  try {
    const db = getDb();
    const snapshot = await db.collection('spaces').get();
    const spaces = snapshot.docs
      .filter(d => d.data().active === true)
      .map(d => ({ id: d.id, name: d.data().name, description: d.data().description, color: d.data().color, capacity: d.data().capacity }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(spaces);
  } catch (error) {
    console.error('Error public spaces:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/reservations', async (req, res) => {
  try {
    const db = getDb();
    const snapshot = await db.collection('reservations').get();
    const reservations = snapshot.docs.map(d => {
      const r = d.data();
      return { id: d.id, eventName: r.eventName, spaceId: r.spaceId, date: r.date, startTime: r.startTime, endTime: r.endTime, responsible: r.responsible };
    });
    res.json(reservations);
  } catch (error) {
    console.error('Error public reservations:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/blocked-dates', async (req, res) => {
  try {
    const db = getDb();
    const snapshot = await db.collection('blockedDates').get();
    res.json(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (error) {
    console.error('Error blocked dates:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;