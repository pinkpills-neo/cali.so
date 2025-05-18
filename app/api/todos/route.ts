import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '~/lib/mongodb'
import { TodoModel, Priority, TodoStatus, type Todo as TodoInterface } from '~/models/Todo';
import { auth } from '@clerk/nextjs';
import { Topic } from '~/models/Topic';

export async function GET(req: NextRequest) {
  console.log('[API Todos GET] Received request to fetch todos.');
  try {
    const { userId } = auth();
    if (!userId) {
      console.error('[API Todos GET] Authorization error: userId is missing.');
      return NextResponse.json({ error: '未授权，用户ID未找到' }, { status: 401 });
    }
    console.log(`[API Todos GET] Authenticated user ID: ${userId}`);

    const { searchParams } = new URL(req.url);
    const topicUuidFromClient = searchParams.get('topicId'); // Renaming for clarity, this is the UUID string

    if (!topicUuidFromClient) {
      console.error('[API Todos GET] Validation error: topicId (as uuid) is missing from query params.');
      return NextResponse.json({ error: '需要topicId参数' }, { status: 400 });
    }
    console.log(`[API Todos GET] Received topicUuidFromClient: "${topicUuidFromClient}"`);

    console.log('[API Todos GET] Attempting to connect to database...');
    await connectToDatabase();
    console.log('[API Todos GET] Successfully connected to database.');

    console.log(`[API Todos GET] Looking for Topic with uuid: "${topicUuidFromClient}" for userId: "${userId}"`);
    const relatedTopic = await Topic.findOne({ uuid: topicUuidFromClient, userId });

    if (!relatedTopic) {
      console.error(`[API Todos GET] Topic not found or not authorized for uuid: "${topicUuidFromClient}" and userId: "${userId}"`);
      // It's okay if a topic doesn't exist or isn't accessible, might just mean no todos for it.
      // Or, if todos should ONLY be fetched if the topic is valid and accessible, return 404.
      // For now, let's assume if topic isn't found/accessible, there are no todos to return for it.
      return NextResponse.json([], { status: 200 }); // Return empty array if topic not found/accessible
    }
    console.log(`[API Todos GET] Found related Topic: _id: ${relatedTopic._id}, name: "${relatedTopic.name}"`);

    // Now use the actual ObjectId of the topic to find todos
    console.log(`[API Todos GET] Fetching todos for topicId (ObjectId): "${relatedTopic._id}" and userId: "${userId}"`);
    const todos = await TodoModel.find({ topicId: relatedTopic._id, userId }).sort({ createdAt: -1 });
    console.log(`[API Todos GET] Found ${todos.length} todos.`);

    return NextResponse.json(todos);
  } catch (error) {
    console.error('[API Todos GET] Error fetching todos:', error);
    if (error instanceof Error && error.name === 'CastError') {
        console.error('[API Todos GET] Mongoose CastError details:', (error as any).path, (error as any).value);
        return NextResponse.json({ error: '无效的ID格式', path: (error as any).path, value: (error as any).value, details: (error as any).message }, { status: 400 });
    }
    return NextResponse.json({ error: '获取待办事项失败', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  console.log('[API Todos POST] Received request to create a new todo.');
  try {
    const { userId } = auth(); // 从 Clerk auth() 中获取 userId
    if (!userId) {
      console.error('[API Todos POST] Authorization error: userId is missing.');
      return NextResponse.json({ error: '未授权，用户ID未找到' }, { status: 401 });
    }
    console.log(`[API Todos POST] Authenticated user ID: ${userId}`);

    const body = await req.json();
    console.log('[API Todos POST] Request body:', JSON.stringify(body, null, 2));

    const { content, topicId: topicUuidFromClient, priority, dueDate } = body;

    if (!content || !topicUuidFromClient) {
      console.error('[API Todos POST] Validation error: content or topicId (as uuid) is missing from body.');
      return NextResponse.json({ error: '缺少必要字段 (content 或 topicId)' }, { status: 400 });
    }
    console.log(`[API Todos POST] Extracted data - content: "${content}", topicUuid: "${topicUuidFromClient}", priority: "${priority}", dueDate: "${dueDate}"`);

    console.log('[API Todos POST] Attempting to connect to database...');
    await connectToDatabase();
    console.log('[API Todos POST] Successfully connected to database.');

    console.log(`[API Todos POST] Looking for Topic with uuid: "${topicUuidFromClient}" for userId: "${userId}"`);
    const relatedTopic = await Topic.findOne({ uuid: topicUuidFromClient, userId });

    if (!relatedTopic) {
      console.error(`[API Todos POST] Topic not found or not authorized for uuid: "${topicUuidFromClient}" and userId: "${userId}"`);
      return NextResponse.json({ error: '关联的主题未找到或无权限访问' }, { status: 404 });
    }
    console.log(`[API Todos POST] Found related Topic: _id: ${relatedTopic._id}, name: "${relatedTopic.name}"`);

    const newTodoData = {
      content: content.trim(),
      topicId: relatedTopic._id, // 使用 Topic 的实际 ObjectId
      priority: priority || Priority.NONE,
      dueDate: dueDate || undefined,
      status: TodoStatus.PENDING,
      userId:userId,
    };
    console.log('[API Todos POST] Prepared new Todo data:', JSON.stringify(newTodoData, null, 2));

    const todo = new TodoModel(newTodoData);
    console.log('[API Todos POST] New Todo instance created (before save):', JSON.stringify(todo.toObject(), null, 2));
  
    console.log('[API Todos POST] Attempting to save the new Todo...');
    await todo.save();
    console.log('[API Todos POST] New Todo saved successfully. ID:', todo._id);
    
    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    console.error('[API Todos POST] Error during Todo creation:', error);
    if (error instanceof Error && error.name === 'ValidationError') {
      console.error('[API Todos POST] Mongoose ValidationError details:', (error as any).errors);
      return NextResponse.json({ error: '数据验证失败', details: (error as any).message }, { status: 400 });
    }
    if (error instanceof Error && error.name === 'CastError') {
        console.error('[API Todos POST] Mongoose CastError details:', (error as any).path, (error as any).value);
        return NextResponse.json({ error: '数据类型转换失败', path: (error as any).path, value: (error as any).value, details: (error as any).message }, { status: 400 });
    }
    return NextResponse.json({ error: '创建待办事项失败', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}