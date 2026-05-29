require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initializeFirebase } = require('./config/firebase');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const spacesRoutes = require('./routes/spaces');
const reservationsRoutes = require('./routes/reservations');
const auditRoutes = require('./routes/audit');
const blockedDatesRoutes = require('./routes/blockedDates');
const reportsRoutes = require('./routes/reports');
const publicRoutes = require('./routes/public');

const app = express();

initializeFirebase();

app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/spaces', spacesRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/blocked-dates', blockedDatesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/public', publicRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('Servidor corriendo en puerto ' + PORT));
