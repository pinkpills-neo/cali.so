import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '~/lib/mongodb';
import { TopicModel } from '~/models/Topic';
import { auth } from '@clerk/nextjs'; // 确保导入 auth

export async function GET(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    await connectToDatabase();

    // 获取属于当前用户的所有主题，并填充它们的待办事项
    // 在 populate 时，对 todos 进行筛选，只选择 userId 匹配的
    const topics = await TopicModel.find({ userId }) // 假设 Topic 模型也有 userId
      .populate({
        path: 'todos',
        match: { userId: userId }, // 关键：只填充属于当前用户的 todos
        // 可选：对填充的 todos 进行排序等
        // options: { sort: { createdAt: -1 } } 
      })
      .sort({ createdAt: -1 });

    return NextResponse.json(topics);
  } catch (error) {
    console.error('[Topics Fetch]', error);
    return NextResponse.json({ error: '获取主题列表失败', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

// POST 函数（如果存在）也应该确保 Topic 与 userId 关联
export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: '主题名称不能为空' }, { status: 400 });
    }

    await connectToDatabase();

    const newTopic = new TopicModel({
      name,
      userId, // 确保 Topic 也与 userId 关联
    });

    await newTopic.save();
    // 返回新创建的 Topic，可能需要填充空的 todos 数组
    const topicWithEmptyTodos = { ...newTopic.toObject(), todos: [] };
    return NextResponse.json(topicWithEmptyTodos, { status: 201 });

  } catch (error) {
    console.error('[Topic Create]', error);
    // ... (错误处理)
  }
}