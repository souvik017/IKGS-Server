import { MongoMemoryServer } from 'mongodb-memory-server';

const mongod = await MongoMemoryServer.create({
  instance: { port: 27017, dbName: 'ikgs' },
});
console.log('MEMORY_MONGO_URI=' + mongod.getUri());

process.on('SIGINT', async () => {
  await mongod.stop();
  process.exit(0);
});
