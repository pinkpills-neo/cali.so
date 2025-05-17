import mongoose, { Document, Model, Schema } from 'mongoose';
import { Topic } from './Topic'; // 假设 Topic 模型也已定义

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
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export interface Todo extends Document {
  _id: string; // Mongoose 会自动处理 _id，但显式定义类型有好处
  content: string;
  topicId: mongoose.Types.ObjectId | Topic; // 可以是 ObjectId 或填充后的 Topic 对象
  userId: string; // 新增 userId 字段
  priority: Priority;
  status: TodoStatus;
  dueDate?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const todoSchema = new Schema<Todo>(
  {
    content: {
      type: String,
      required: [true, '内容不能为空'],
      trim: true,
    },
    topicId: {
      type: Schema.Types.ObjectId,
      ref: 'Topic',
      required: [true, '主题ID不能为空'],
    },
    userId: { // 新增 userId 字段定义
      type: String,
      required: [true, '用户ID不能为空'],
      index: true, // 为 userId 添加索引以提高查询性能
    },
    priority: {
      type: String,
      enum: Object.values(Priority),
      default: Priority.NONE,
    },
    status: {
      type: String,
      enum: Object.values(TodoStatus),
      default: TodoStatus.PENDING,
    },
    dueDate: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true, // 自动管理 createdAt 和 updatedAt
  }
);

// 如果模型已存在，则使用现有模型，否则创建新模型
export const TodoModel: Model<Todo> = mongoose.models.Todo || mongoose.model<Todo>('Todo', todoSchema);