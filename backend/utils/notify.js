const Notification = require('../models/Notification');

const notify = async ({ user, type, title, message, link, metadata = {} }) => {
  try {
    await Notification.create({ user, type, title, message, link, metadata });
  } catch (err) {
    console.error('Notification error:', err.message);
  }
};

const notifyMany = async (users, payload) => {
  try {
    const docs = users.map((user) => ({ user, ...payload }));
    await Notification.insertMany(docs);
  } catch (err) {
    console.error('Notify many error:', err.message);
  }
};

module.exports = { notify, notifyMany };