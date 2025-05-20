import { auth } from '@clerk/nextjs';
import { nanoid } from 'nanoid'; // 用于生成 uuid，如果创建 Topic 时需要
import { type NextRequest, NextResponse } from 'next/server';

import { connectToDatabase } from '~/lib/mongodb';
import { TodoModel } from '~/models/Todo'; // 新增：导入 TodoModel
import { Topic } from '~/models/Topic'; // 确保 Topic 模型已正确导出

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
    // 选择需要返回的字段，确保包含 name 和 uuid
    // _id 通常也建议返回，前端列表渲染时可用作 key
    // createdAt 和 updatedAt 也是常用的信息
    const topics = await Topic.find({ userId })
      .select('name uuid _id createdAt updatedAt') // 根据前端实际需要调整字段
      .sort({ createdAt: -1 }); // 按创建时间降序排列

    // console.log(`[API Topics GET] Found ${topicsFromDB.length} topics for the user.`); // 原错误行
    console.log(`[API Topics GET] Found ${topics.length} topics for the user.`); // 已修正

    // 为每个 topic 获取关联的 todos
    const topicsWithTodos = await Promise.all(
      // topicsFromDB.map(async (topic) => { // 原错误行
      topics.map(async (topic) => { // 已修正
        // 使用 topic._id (ObjectId) 而不是 topic.uuid (string) 来查询
        // const todos = await Todo.find({ topicId: topic._id }).lean(); // 原错误行
        const todos = await TodoModel.find({ topicId: topic._id }).lean(); // 已修正，使用 TodoModel
        return { ...topic.toObject(), todos }; // 确保使用 .toObject()
      })
    );

    console.log(`[API Topics GET] Successfully fetched todos for all topics.`);
    // return NextResponse.json(topics, { status: 200 }); // 原错误行
    return NextResponse.json(topicsWithTodos, { status: 200 }); // 已修正，返回包含todos的主题
  } catch (error) {
    console.error('[API Topics GET] Error fetching topics:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: '获取主题列表失败', details: errorMessage }, { status: 500 });
  }
}

// 如果您还需要在此文件中处理创建新 Topic (POST请求) 的逻辑，可以像下面这样添加：
export async function POST(req: NextRequest) {
  console.log('[API Topics POST] Received request to create a new topic.');
  try {
    const { userId } = auth();
    if (!userId) {
      console.error('[API Topics POST] Authorization error: userId is missing.');
      return NextResponse.json({ error: '未授权，用户ID未找到' }, { status: 401 });
    }
    console.log(`[API Topics POST] Authenticated user ID: ${userId}`);

    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      console.error('[API Topics POST] Validation error: name is missing or invalid.');
      return NextResponse.json({ error: '主题名称不能为空' }, { status: 400 });
    }
    console.log(`[API Topics POST] Received topic name: "${name}"`);

    console.log('[API Topics POST] Attempting to connect to database...');
    await connectToDatabase();
    console.log('[API Topics POST] Successfully connected to database.');

    const newTopicData = {
      name: name.trim(),
      userId,
      uuid: nanoid(), // 生成唯一的 uuid
    };
    console.log('[API Topics POST] Prepared new Topic data:', JSON.stringify(newTopicData, null, 2));

    const topic = new Topic(newTopicData);
    console.log('[API Topics POST] New Topic instance created (before save).');

    console.log('[API Topics POST] Attempting to save the new Topic...');
    await topic.save();
    console.log('[API Topics POST] New Topic saved successfully. ID:', topic._id, "UUID:", topic.uuid);
    
    // 返回创建的 Topic 对象，包含 _id 和 uuid
    return NextResponse.json(topic, { status: 201 });
  } catch (error) {
    console.error('[API Topics POST] Error during Topic creation:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (error instanceof Error && error.name === 'ValidationError') {
      console.error('[API Topics POST] Mongoose ValidationError details:', (error as any).errors);
      return NextResponse.json({ error: '数据验证失败', details: errorMessage }, { status: 400 });
    }
    return NextResponse.json({ error: '创建主题失败', details: errorMessage }, { status: 500 });
  }
}