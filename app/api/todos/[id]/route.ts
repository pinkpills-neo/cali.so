import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '~/lib/mongodb'
import { TodoModel, type Todo as TodoInterface } from '~/models/Todo'
import { auth } from '@clerk/nextjs'

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

export async function DELETE(
  _req: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = auth() 
    if (!userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    await connectToDatabase()
    
    const result = await TodoModel.findOneAndDelete({ _id: params.id, userId }) // 恢复 userId 条件

    if (!result) {
      return NextResponse.json({ error: '待办事项未找到或无权限删除' }, { status: 404 })
    }

    return NextResponse.json({ message: '待办事项删除成功' }, { status: 200 })
  } catch (error) {
    console.error('[Todo Delete]', error)
    if (error instanceof Error && error.name === 'CastError') {
      return NextResponse.json({ error: '无效的待办事项ID格式' }, { status: 400 });
    }
    return NextResponse.json({ error: '删除待办事项失败', details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}