import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '~/lib/mongodb'
import { Todo, Priority, TodoStatus } from '~/models/Todo'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const topicId = searchParams.get('topicId')
  
  if (!topicId) {
    return NextResponse.json({ error: '需要topicId参数' }, { status: 400 })
  }

  try {
    await connectToDatabase()
    const todos = await Todo.find({ topicId }).sort({ createdAt: -1 })
    return NextResponse.json(todos)
  } catch (error) {
    console.error('[Todos]', error)
    return NextResponse.json({ error: '获取待办事项失败' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    await connectToDatabase()
    const todo = new Todo(body)
    await todo.save()
    return NextResponse.json(todo)
  } catch (error) {
    console.error('[Todos]', error)
    return NextResponse.json({ error: '创建待办事项失败' }, { status: 500 })
  }
}