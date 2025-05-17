// ... existing code ...
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs'
import { connectToDatabase } from '~/lib/mongodb'
import Topic from '~/models/Topic'
import Todo from '~/models/Todo' // 导入 Todo 模型

export async function GET(req: NextRequest) {
  console.log('[API Topics GET] Received request to fetch all topics for the user.');
  try {
    const { userId } = auth();
    if (!userId) {
      console.error('[API Topics GET] Authorization error: userId is missing.');
      return NextResponse.json({ error: '未授权，用户ID未找到' }, { status: 401 });
    }
    console.log(`[API Topics GET] Authenticated user ID: ${userId}`);

    console.log('[API Topics GET] Attempting to connect to database...');
    await connectToDatabase();
    console.log('[API Topics GET] Successfully connected to database.');

    console.log(`[API Topics GET] Fetching all topics for userId: "${userId}"`);
    const topicsFromDB = await Topic.find({ userId })
      .select('name uuid _id createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean(); // 使用 .lean() 获取普通 JavaScript 对象，方便修改

    console.log(`[API Topics GET] Found ${topicsFromDB.length} topics for the user.`);

    // 为每个 topic 获取关联的 todos
    const topicsWithTodos = await Promise.all(
      topicsFromDB.map(async (topic) => {
        const todos = await Todo.find({ topicId: topic.uuid }).lean();
        return { ...topic, todos };
      })
    );

    console.log(`[API Topics GET] Successfully fetched todos for all topics.`);

    return NextResponse.json(topicsWithTodos, { status: 200 });
  } catch (error) {
// ... existing code ...