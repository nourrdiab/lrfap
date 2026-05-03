const AuditLog = require('../models/AuditLog');

const logAction = async ({
  actor,
  actorRole,
  action,
  targetType,
  targetId,
  outcome = 'success',
  metadata = {},
  ipAddress,
}) => {
  try {
    await AuditLog.create({
      actor,
      actorRole,
      action,
      targetType,
      targetId,
      outcome,
      metadata,
      ipAddress,
    });
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
};

module.exports = { logAction };