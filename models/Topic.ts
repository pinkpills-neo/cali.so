import mongoose from 'mongoose'
import crypto from 'crypto'

const generateTopicUUID = (userId: string) => {
  const timestamp = Date.now().toString()
  const salt = 'topic_salt_' // 可以设置一个固定的盐值
  const hash = crypto
    .createHash('sha256')
    .update(`${userId}_${timestamp}_${salt}`)
    .digest('hex')
  return hash.substring(0, 32) // 取前32位作为uuid
}

const topicSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  uuid: {
    type: String,
    required: true,
    unique: true,
    default: function(this: any) {
      return generateTopicUUID(this.userId)
    }
  }
}, {
  timestamps: true
})

export const Topic = mongoose.models.Topic || mongoose.model('Topic', topicSchema)