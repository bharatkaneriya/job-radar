// One mongoose connection per process. On Vercel the module stays warm between
// invocations, so the cached promise avoids reconnecting on every request.
import mongoose from 'mongoose';

let pending = null;

export function connectDb(uri = process.env.MONGODB_URI) {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (!pending) {
    if (!uri) throw new Error('MONGODB_URI is not set');
    pending = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 5 })
      .then((m) => m.connection)
      .catch((err) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}
