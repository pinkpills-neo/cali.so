import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '~/lib/mongodb'
import { Todo } from '~/models/Todo'

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    await connectToDatabase()
    const todo = await Todo.findByIdAndUpdate(params.id, body, { new: true })
    return NextResponse.json(todo)
  } catch (error) {
    console.error('[Todo Update]', error)
    return NextResponse.json({ error: '更新待办事项失败' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase()
    await Todo.findByIdAndDelete(params.id)
    return NextResponse.json({ status: 'success' })
  } catch (error) {
    console.error('[Todo Delete]', error)
    return NextResponse.json({ error: '删除待办事项失败' }, { status: 500 })
  }
}