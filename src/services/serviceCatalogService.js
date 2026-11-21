const Service = require('../models/Service');

let priceCleanup;
async function removeLegacyServicePrices() {
  if (!priceCleanup) priceCleanup = Service.collection.updateMany({}, { $unset: { startingPrice: 1 } });
  await priceCleanup;
}

module.exports = { removeLegacyServicePrices };
