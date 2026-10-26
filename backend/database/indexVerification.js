const mongoose = require('mongoose');

const getManagedModels = () => [
  { name: 'Sale', model: require('../models/Sale') },
  { name: 'SaleReturn', model: require('../models/SaleReturn') },
  { name: 'Purchase', model: require('../models/Purchase') },
  { name: 'PurchaseReturn', model: require('../models/PurchaseReturn') },
  { name: 'PaymentTransaction', model: require('../models/PaymentTransaction') },
  { name: 'Customer', model: require('../models/Customer') },
  { name: 'Supplier', model: require('../models/Supplier') },
  { name: 'Product', model: require('../models/Product') },
  { name: 'InventoryTransaction', model: require('../models/InventoryTransaction') }
];

/**
 * Attaches observable logging listeners to all managed models' index events.
 */
const attachIndexListeners = () => {
  const models = getManagedModels();
  models.forEach(({ name, model }) => {
    model.on('index', (err) => {
      if (err) {
        console.error(`❌ [MONGODB INDEX ERROR] Model '${name}' on collection '${model.collection.name}': ${err.message}`);
      } else {
        console.log(`✅ [MONGODB INDEX OK] Model '${name}' on collection '${model.collection.name}' indexes synchronized.`);
      }
    });
  });
};

/**
 * Directly inspects collection indexes on MongoDB Atlas and verifies required unique compound indexes.
 */
const verifyDatabaseIndexes = async () => {
  const models = getManagedModels();
  const report = {};

  for (const { name, model } of models) {
    try {
      await model.init();
      const indexes = await model.collection.indexes();

      const partialIndex = indexes.find(
        (idx) =>
          idx.key &&
          idx.key.userId === 1 &&
          idx.key.clientUuid === 1 &&
          idx.unique === true &&
          idx.partialFilterExpression &&
          idx.partialFilterExpression.clientUuid
      );

      const legacySparseIndex = indexes.find(
        (idx) =>
          idx.key &&
          idx.key.userId === 1 &&
          idx.key.clientUuid === 1 &&
          idx.unique === true &&
          !idx.partialFilterExpression &&
          idx.sparse === true
      );

      report[name] = {
        collection: model.collection.name,
        totalIndexes: indexes.length,
        hasClientUuidIndex: Boolean(partialIndex || legacySparseIndex),
        hasPartialFilter: Boolean(partialIndex),
        indexName: partialIndex ? partialIndex.name : (legacySparseIndex ? legacySparseIndex.name : null),
        hasObsoleteSparseIndex: Boolean(legacySparseIndex && partialIndex),
        obsoleteIndexName: (legacySparseIndex && partialIndex) ? legacySparseIndex.name : null,
        status: partialIndex ? 'VERIFIED' : 'FAILED'
      };
    } catch (err) {
      report[name] = {
        collection: model.collection.name,
        error: err.message,
        status: 'ERROR'
      };
    }
  }

  return report;
};

module.exports = {
  getManagedModels,
  attachIndexListeners,
  verifyDatabaseIndexes
};
