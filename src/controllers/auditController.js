async function logAudit(db, { action, targetId, targetType, details, performedBy }) {
  await db.collection('auditLog').add({
    action,
    targetId,
    targetType,
    details,
    performedBy: {
      uid: performedBy.uid,
      name: performedBy.name,
      email: performedBy.email,
      role: performedBy.role
    },
    timestamp: new Date().toISOString()
  });
}

module.exports = { logAudit };
