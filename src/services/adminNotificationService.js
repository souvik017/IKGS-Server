const { EventEmitter } = require('events');

const events = new EventEmitter();
events.setMaxListeners(0);

function publishAdminNotification(notification) {
  const payload = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, createdAt: new Date().toISOString(), ...notification };
  events.emit('notification', payload);
  return payload;
}

function subscribe(listener) {
  events.on('notification', listener);
  return () => events.off('notification', listener);
}

module.exports = { publishAdminNotification, subscribe };
