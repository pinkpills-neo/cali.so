import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_CONNECTION_STRING

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_CONNECTION_STRING environment variable inside .env')
}

let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((mongoose) => {
      return mongoose
    })
  }

  cached.conn = await cached.promise
  return cached.conn
}