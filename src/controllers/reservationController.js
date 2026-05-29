async function checkConflict(db, { spaceId, date, startTime, endTime, excludeId = null }) {
  const snapshot = await db.collection('reservations')
    .where('spaceId', '==', spaceId)
    .where('date', '==', date)
    .get();

  for (const doc of snapshot.docs) {
    if (excludeId && doc.id === excludeId) continue;
    const res = doc.data();
    if (startTime < res.endTime && endTime > res.startTime) {
      return { ...res, id: doc.id };
    }
  }
  return null;
}

module.exports = { checkConflict };
