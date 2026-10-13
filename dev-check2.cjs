const mongoose = require('mongoose');
const Service = require('./src/models/Service');
(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/ikgs');
  console.log('collection name:', Service.collection.name);
  const all = await Service.countDocuments({});
  const active = await Service.countDocuments({ active: true });
  console.log('all services:', all, 'active:', active);
  const sample = await Service.findOne({});
  console.log('sample:', sample && { title: sample.title, slug: sample.slug, active: sample.active });
  await mongoose.disconnect();
})();
