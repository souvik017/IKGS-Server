const mongoose = require('mongoose');
(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/ikgs');
  const db = mongoose.connection.db;
  const cols = await db.listCollections().toArray();
  console.log('collections:', cols.map(c => c.name).join(', '));
  for (const c of ['services', 'sitesettings', 'galleryimages', 'admins']) {
    try { console.log(c, await db.collection(c).countDocuments()); } catch (e) { console.log(c, 'ERR', e.message); }
  }
  console.log('dbs:', (await mongoose.connection.db.admin().listDatabases()).databases.map(d => d.name).join(', '));
  await mongoose.disconnect();
})();
