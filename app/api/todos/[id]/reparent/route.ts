import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '~/lib/mongodb';
import { TodoModel, type Todo } from '~/models/Todo'; // 确保 Todo 类型被导入
import { auth } from '@clerk/nextjs';
import mongoose from 'mongoose';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } } // id of the todo being moved
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { newParentId }: { newParentId: string | null } = await req.json();
    const draggedTodoId = params.id;

    if (draggedTodoId === newParentId) {
      return NextResponse.json({ error: '不能将一个任务设置为自身的父级' }, { status: 400 });
    }

    await connectToDatabase();

    // 使用事务来确保数据一致性
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. 找到被拖拽的 Todo
      const draggedTodo = await TodoModel.findOne({ _id: draggedTodoId, userId }).session(session);
      if (!draggedTodo) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json({ error: '被移动的待办事项未找到或无权限操作' }, { status: 404 });
      }

      const oldParentId = draggedTodo.parentId;

      // 2. 如果存在旧的父级，从旧父级的 children 中移除 draggedTodo
      if (oldParentId && oldParentId.toString() !== newParentId) { // 检查 oldParentId 是否与 newParentId 相同
        const oldParentTodo = await TodoModel.findOne({ _id: oldParentId, userId }).session(session);
        if (oldParentTodo) {
          oldParentTodo.children = oldParentTodo.children?.filter(
            (childId) => childId.toString() !== draggedTodoId
          );
          await oldParentTodo.save({ session });
        }
      }

      // 3. 更新被拖拽 Todo 的 parentId
      draggedTodo.parentId = newParentId ? new mongoose.Types.ObjectId(newParentId) : null;
      await draggedTodo.save({ session });

      // 4. 如果存在新的父级，将 draggedTodo 添加到新父级的 children 中
      if (newParentId) {
        const newParentTodo = await TodoModel.findOne({ _id: newParentId, userId }).session(session);
        if (!newParentTodo) {
          await session.abortTransaction();
          session.endSession();
          // 这个错误理论上不应该发生，如果前端正确传递了存在的 newParentId
          return NextResponse.json({ error: '新的父级待办事项未找到或无权限操作' }, { status: 404 });
        }
        if (!newParentTodo.children?.find(childId => childId.toString() === draggedTodoId)) {
          newParentTodo.children = [...(newParentTodo.children || []), new mongoose.Types.ObjectId(draggedTodoId)];
          await newParentTodo.save({ session });
        }
      }

      await session.commitTransaction();
      session.endSession();

      return NextResponse.json(draggedTodo);

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('[Todo Reparent PATCH]', error);
      if (error instanceof mongoose.Error.CastError) {
        return NextResponse.json({ error: '无效的ID格式', details: error.message }, { status: 400 });
      }
      return NextResponse.json({ error: '更新待办事项父级失败', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }

  } catch (error) {
    console.error('[Todo Reparent PATCH - Outer]', error);
    return NextResponse.json({ error: '更新待办事项父级失败', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}