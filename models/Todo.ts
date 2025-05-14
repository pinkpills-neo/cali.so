import mongoose, { Schema, model, models } from 'mongoose'

export enum Priority {
  NONE = 'NONE',
  P00 = 'P00',
  P0 = 'P0',
  P1 = 'P1',
  P2 = 'P2',
  P3 = 'P3',
}

export enum TodoStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
}

export interface Todo {
  _id: string
  content: string
  status: TodoStatus
  priority: Priority
  dueDate?: string
  topicId: string
  createdAt: string
  updatedAt: string
}

const todoSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: Object.values(Priority),
    default: Priority.NONE
  },
  dueDate: {
    type: Date,
    required: false
  },
  status: {
    type: String,
    enum: Object.values(TodoStatus),
    default: TodoStatus.PENDING
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Todo',
    required: false
  },
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    required: true
  }
}, {
  timestamps: true
})

// 使用动态导入来处理服务器端逻辑
export const TodoModel = (typeof window === 'undefined') ? (models.Todo || model('Todo', todoSchema)) : null