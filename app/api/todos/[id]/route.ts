import { auth } from '@clerk/nextjs/server'; // 使用 server import
import { type NextRequest, NextResponse } from 'next/server';
import mongoose, { ClientSession } from 'mongoose'; // 引入 mongoose 和 ClientSession

import { connectToDatabase } from '~/lib/mongodb';
import { TodoModel, type Todo as TodoInterface } from '~/models/Todo';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = auth() 
    if (!userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await req.json() 
    await connectToDatabase()

    // 在这里添加日志打印
    console.log(`[Todo Update PUT] Attempting to update todo with id: ${params.id}`);
    console.log(`[Todo Update PUT] User ID: ${userId}`);
    console.log(`[Todo Update PUT] Request body:`, body);
    
    const todo = await TodoModel.findOneAndUpdate(
      { _id: params.id, userId }, // 恢复 userId 条件，确保用户只能更新自己的 Todo
      body, 
      { new: true, runValidators: true } 
    )

    if (!todo) {
      // 如果找不到 Todo 或者 Todo 不属于当前用户
      return NextResponse.json({ error: '待办事项未找到或无权限更新' }, { status: 404 })
    }

    return NextResponse.json(todo)
  } catch (error) {
    console.error('[Todo Update]', error)
    if (error instanceof Error && error.name === 'CastError') {
      return NextResponse.json({ error: '无效的ID格式或数据类型错误' }, { status: 400 });
    }
    if (error instanceof Error && error.name === 'ValidationError') {
      return NextResponse.json({ error: '数据验证失败', details: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: '更新待办事项失败', details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

// 辅助函数：递归删除子待办事项
async function deleteChildrenRecursive(parentId: string, userId: string, session: ClientSession): Promise<void> {
  // 查找所有直接子项
  const children = await TodoModel.find({ parentId, userId }).session(session).lean() as Todo[];

  if (children.length === 0) {
    return; // 没有子项了，递归结束
  }

  for (const child of children) {
    // 递归删除当前子项的子项
    await deleteChildrenRecursive(child._id.toString(), userId, session);
    // 删除当前子项
    await TodoModel.deleteOne({ _id: child._id, userId }).session(session);
    console.log(`[Todo Delete Recursive] Deleted child todo: ${child._id}`);
  }
}


export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { id: todoId } = params;

    if (!todoId || !mongoose.Types.ObjectId.isValid(todoId)) {
      return NextResponse.json({ error: '无效的待办事项ID格式' }, { status: 400 });
    }

    await connectToDatabase();

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. 查找要删除的待办事项
      const todoToDelete = await TodoModel.findOne({ _id: todoId, userId }).session(session).lean() as Todo | null;

      if (!todoToDelete) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json({ error: '待办事项未找到或无权限删除' }, { status: 404 });
      }

      // 2. 如果待办事项有父级，从父级的 children 数组中移除此待办事项的 ID
      if (todoToDelete.parentId) {
        await TodoModel.updateOne(
          { _id: todoToDelete.parentId, userId },
          { $pull: { children: todoToDelete._id } }
        ).session(session);
        console.log(`[Todo Delete] Removed todo ${todoToDelete._id} from parent ${todoToDelete.parentId}'s children array.`);
      }

      // 3. 递归删除所有子待办事项
      //    我们直接使用 todoToDelete._id 作为起始 parentId 来删除其所有后代
      await deleteChildrenRecursive(todoToDelete._id.toString(), userId, session);
      console.log(`[Todo Delete] Finished recursive deletion of children for todo: ${todoToDelete._id}`);


      // 4. 删除该待办事项本身
      const deleteResult = await TodoModel.deleteOne({ _id: todoToDelete._id, userId }).session(session);

      if (deleteResult.deletedCount === 0) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json({ error: '删除主待办事项失败，请重试' }, { status: 500 });
      }
      console.log(`[Todo Delete] Successfully deleted main todo: ${todoToDelete._id}`);

      await session.commitTransaction();
      session.endSession();

      return NextResponse.json({ message: '待办事项及其所有子项已成功删除' }, { status: 200 });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('[Todo Delete Transaction Error]', error);
      const errorMessage = error instanceof Error ? error.message : '删除待办事项时发生内部错误';
      return NextResponse.json({ error: '删除待办事项失败', details: errorMessage }, { status: 500 });
    }

  } catch (error) {
    console.error('[Todo Delete General Error]', error);
    if (error instanceof mongoose.Error.CastError) {
      return NextResponse.json({ error: '无效的待办事项ID格式' }, { status: 400 });
    }
    const errorMessage = error instanceof Error ? error.message : '处理删除请求时发生未知错误';
    return NextResponse.json({ error: '服务器内部错误', details: errorMessage }, { status: 500 });
  }
}