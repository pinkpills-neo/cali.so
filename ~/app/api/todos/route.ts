import { auth } from '@clerk/nextjs'; // 确保已导入 auth
import { TodoModel, TodoStatus, Priority } from '~/models/Todo'; // 确保导入正确

export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await req.json();
    const { content, topicId, priority, dueDate } = body;

    if (!content || !topicId) {
      return NextResponse.json({ error: '内容和主题ID不能为空' }, { status: 400 });
    }

    await connectToDatabase();

    const newTodo = new TodoModel({
      content,
      topicId,
      userId, // 在创建时保存 userId
      priority: priority || Priority.NONE,
      status: TodoStatus.PENDING, // 默认状态
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });

    await newTodo.save();
    return NextResponse.json(newTodo, { status: 201 });
  } catch (error) {
    console.error('[Todo Create]', error);
    // ... (错误处理保持不变)
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const topicId = searchParams.get('topicId');

    let query: any = { userId }; // 基础查询条件：只获取当前用户的 todos

    if (topicId) {
      query.topicId = topicId; // 如果提供了 topicId，则进一步筛选
    }

    // 根据 userId 和可选的 topicId 查询 todos
    const todos = await TodoModel.find(query).sort({ createdAt: -1 }); // 按创建时间降序

    return NextResponse.json(todos);
  } catch (error) {
    console.error('[Todos Fetch]', error);
    // ... (错误处理保持不变)
  }
}