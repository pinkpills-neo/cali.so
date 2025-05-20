import { auth } from '@clerk/nextjs';
import mongoose from 'mongoose';
import { type NextRequest, NextResponse } from 'next/server';

import { connectToDatabase } from '~/lib/mongodb';
import {TodoModel } from '~/models/Todo'; // 确保 Todo 类型被导入

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } } // id of the todo being moved
) {
  console.log(`[Todo Reparent PATCH] Received request to reparent todo. Path params: ${JSON.stringify(params)}`);
  try {
    const { userId } = auth();
    if (!userId) {
      console.log('[Todo Reparent PATCH] Unauthorized: No userId found.');
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    console.log(`[Todo Reparent PATCH] Authorized userId: ${userId}`);

    const { newParentId }: { newParentId: string | null } = await req.json();
    const draggedTodoId = params.id;
    console.log(`[Todo Reparent PATCH] Request body parsed. draggedTodoId: ${draggedTodoId}, newParentId: ${newParentId}`);

    if (draggedTodoId === newParentId) {
      console.log('[Todo Reparent PATCH] Error: Cannot reparent a todo to itself.');
      return NextResponse.json({ error: '不能将一个任务设置为自身的父级' }, { status: 400 });
    }

    await connectToDatabase();
    console.log('[Todo Reparent PATCH] Connected to database.');

    // 使用事务来确保数据一致性
    const session = await mongoose.startSession();
    console.log('[Todo Reparent PATCH] Mongoose session started.');
    session.startTransaction();
    console.log('[Todo Reparent PATCH] Mongoose transaction started.');

    try {
      // 1. 找到被拖拽的 Todo
      console.log(`[Todo Reparent PATCH] Finding draggedTodo with _id: ${draggedTodoId} and userId: ${userId}`);
      const draggedTodo = await TodoModel.findOne({ _id: draggedTodoId, userId }).session(session);
      if (!draggedTodo) {
        console.log('[Todo Reparent PATCH] draggedTodo not found or user not authorized.');
        await session.abortTransaction();
        console.log('[Todo Reparent PATCH] Transaction aborted.');
        session.endSession();
        console.log('[Todo Reparent PATCH] Session ended.');
        return NextResponse.json({ error: '被移动的待办事项未找到或无权限操作' }, { status: 404 });
      }
      console.log(`[Todo Reparent PATCH] Found draggedTodo: ${JSON.stringify(draggedTodo)}`);

      const oldParentId = draggedTodo.parentId;
      console.log(`[Todo Reparent PATCH] oldParentId of draggedTodo: ${oldParentId}`);

      // 2. 如果存在旧的父级，从旧父级的 children 中移除 draggedTodo
      if (oldParentId && oldParentId.toString() !== newParentId) {
        console.log(`[Todo Reparent PATCH] oldParentId exists (${oldParentId}) and is different from newParentId (${newParentId}). Attempting to remove draggedTodo from old parent's children.`);
        const oldParentTodo = await TodoModel.findOne({ _id: oldParentId, userId }).session(session);
        if (oldParentTodo) {
          console.log(`[Todo Reparent PATCH] Found oldParentTodo: ${JSON.stringify(oldParentTodo)}`);
          const oldChildrenCount = oldParentTodo.children?.length || 0;
          oldParentTodo.children = oldParentTodo.children?.filter(
            (childId) => childId.toString() !== draggedTodoId
          );
          const newChildrenCount = oldParentTodo.children?.length || 0;
          console.log(`[Todo Reparent PATCH] oldParentTodo children updated. Count before: ${oldChildrenCount}, Count after: ${newChildrenCount}`);
          await oldParentTodo.save({ session });
          console.log('[Todo Reparent PATCH] oldParentTodo saved.');
        } else {
          console.log(`[Todo Reparent PATCH] oldParentTodo with _id: ${oldParentId} not found. Skipping removal from old parent.`);
        }
      } else {
        console.log(`[Todo Reparent PATCH] No oldParentId, or oldParentId is the same as newParentId. Skipping removal from old parent. oldParentId: ${oldParentId}, newParentId: ${newParentId}`);
      }

      // 3. 更新被拖拽 Todo 的 parentId
      console.log(`[Todo Reparent PATCH] Updating draggedTodo's parentId to: ${newParentId}`);
      draggedTodo.parentId = newParentId ? new mongoose.Types.ObjectId(newParentId) : null;
      await draggedTodo.save({ session });
      console.log(`[Todo Reparent PATCH] draggedTodo saved with new parentId. Updated draggedTodo: ${JSON.stringify(draggedTodo)}`);

      // 4. 如果存在新的父级，将 draggedTodo 添加到新父级的 children 中
      if (newParentId) {
        console.log(`[Todo Reparent PATCH] newParentId exists (${newParentId}). Attempting to add draggedTodo to new parent's children.`);
        const newParentTodo = await TodoModel.findOne({ _id: newParentId, userId }).session(session);
        if (!newParentTodo) {
          console.log(`[Todo Reparent PATCH] newParentTodo with _id: ${newParentId} not found.`);
          await session.abortTransaction();
          console.log('[Todo Reparent PATCH] Transaction aborted.');
          session.endSession();
          console.log('[Todo Reparent PATCH] Session ended.');
          return NextResponse.json({ error: '新的父级待办事项未找到或无权限操作' }, { status: 404 });
        }
        console.log(`[Todo Reparent PATCH] Found newParentTodo: ${JSON.stringify(newParentTodo)}`);
        if (!newParentTodo.children?.find(childId => childId.toString() === draggedTodoId)) {
          const oldChildrenCount = newParentTodo.children?.length || 0;
          newParentTodo.children = [...(newParentTodo.children || []), new mongoose.Types.ObjectId(draggedTodoId)];
          const newChildrenCount = newParentTodo.children?.length;
          console.log(`[Todo Reparent PATCH] newParentTodo children updated. Count before: ${oldChildrenCount}, Count after: ${newChildrenCount}`);
          await newParentTodo.save({ session });
          console.log('[Todo Reparent PATCH] newParentTodo saved.');
        } else {
          console.log(`[Todo Reparent PATCH] draggedTodoId (${draggedTodoId}) already exists in newParentTodo's children. Skipping addition.`);
        }
      } else {
        console.log('[Todo Reparent PATCH] No newParentId. draggedTodo becomes a root todo.');
      }

      await session.commitTransaction();
      console.log('[Todo Reparent PATCH] Transaction committed.');
      session.endSession();
      console.log('[Todo Reparent PATCH] Session ended.');

      console.log(`[Todo Reparent PATCH] Successfully reparented todo. Returning updated draggedTodo: ${JSON.stringify(draggedTodo)}`);
      return NextResponse.json(draggedTodo);

    } catch (error) {
      await session.abortTransaction();
      console.log('[Todo Reparent PATCH] Transaction aborted due to error in try block.');
      session.endSession();
      console.log('[Todo Reparent PATCH] Session ended due to error in try block.');
      console.error('[Todo Reparent PATCH] Error during transaction:', error);
      if (error instanceof mongoose.Error.CastError) {
        return NextResponse.json({ error: '无效的ID格式', details: error.message }, { status: 400 });
      }
      return NextResponse.json({ error: '更新待办事项父级失败', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }

  } catch (error) {
    console.error('[Todo Reparent PATCH - Outer Catch] Error:', error);
    return NextResponse.json({ error: '更新待办事项父级失败', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}