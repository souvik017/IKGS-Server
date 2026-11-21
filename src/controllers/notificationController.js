const asyncHandler = require('../utils/asyncHandler');
const { subscribe } = require('../services/adminNotificationService');

exports.stream = asyncHandler(async (req, res) => {
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  res.write('event: ready\ndata: {}\n\n');
  const unsubscribe = subscribe((notification) => {
    res.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 25000);
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});
