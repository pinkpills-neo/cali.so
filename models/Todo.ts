import mongoose, { Schema, model, models, Document, Types } from 'mongoose' // 确保导入 Document 和 Types

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

// 更新 Todo interface 以更好地匹配 Mongoose 文档结构并添加层级字段
export interface Todo extends Document {
  // _id: string; // Document 已经包含了 _id
  content: string;
  status: TodoStatus;
  priority: Priority;
  dueDate?: Date; // Mongoose schema 中是 Date 类型
  topicId: Types.ObjectId; // Mongoose schema 中是 ObjectId
  userId: string; // 假设您之前已经添加了 userId
  parentId?: Types.ObjectId | Todo; // 父 Todo，可以是 ObjectId 或填充后的 Todo 对象
  children?: (Types.ObjectId | Todo)[]; // 子 Todo 列表
  createdAt: Date; // Mongoose timestamps 提供的是 Date 类型
  updatedAt: Date; // Mongoose timestamps 提供的是 Date 类型
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
  // parentId 字段已存在，用于表示父 Todo
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Todo', // 自引用到 Todo 模型
    required: false
  },
  // 新增 children 字段，用于表示子 Todo 列表
  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Todo' // 自引用到 Todo 模型
  }],
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    required: true
  },
  // 假设您之前已经添加了 userId 字段，如果还没有，请取消注释或添加它
  userId: {
    type: String,
    required: true,
    index: true,
  },
}, {
  timestamps: true // 自动管理 createdAt 和 updatedAt
})

// 更新模型导出，确保类型正确
export const TodoModel = (typeof window === 'undefined') 
  ? (models.Todo as mongoose.Model<Todo> || model<Todo>('Todo', todoSchema)) 
  : null;