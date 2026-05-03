const AuditLog = require('../models/AuditLog');

exports.getAuditLogs = async (req, res) => {
  try {
    const { action, actorRole, targetType, limit = 100, skip = 0 } = req.query;
    const filter = {};
    if (action) filter.action = action;
    if (actorRole) filter.actorRole = actorRole;
    if (targetType) filter.targetType = targetType;

    const logs = await AuditLog.find(filter)
      .populate('actor', 'firstName lastName email role')
      .sort('-createdAt')
      .limit(Math.min(parseInt(limit), 500))
      .skip(parseInt(skip));

    const total = await AuditLog.countDocuments(filter);

    res.json({ total, count: logs.length, logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};