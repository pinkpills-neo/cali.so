import { NextResponse } from 'next/server'
import { connectToDatabase } from '~/lib/mongodb'
import { Topic } from '~/models/Topic'
import { auth } from '@clerk/nextjs'

export async function GET() {
  try {
    console.log('[Topics API] 开始获取主题列表')
    await connectToDatabase()
    const { userId } = auth()
    
    if (!userId) {
      console.log('[Topics API] 未找到用户ID，返回空列表')
      return NextResponse.json([])
    }

    const topics = await Topic.find({ userId }).sort({ createdAt: -1 })
    console.log(`[Topics API] 成功获取主题列表，共 ${topics.length} 个主题`)
    return NextResponse.json(topics)
  } catch (error) {
    console.error('[Topics API] 获取主题列表失败:', error)
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    console.log('[Topics API] 开始创建新主题')
    const { userId } = auth()
    
    if (!userId) {
      console.log('[Topics API] 未找到用户ID，创建失败')
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    await connectToDatabase()
    const body = await request.json()
    const { name } = body
    
    console.log(`[Topics API] 创建主题，名称: ${name}, 用户ID: ${userId}`)
    const topic = new Topic({
      name,
      userId
    })
    
    await topic.save()
    console.log(`[Topics API] 主题创建成功，UUID: ${topic.uuid}`)
    
    return NextResponse.json(topic)
  } catch (error) {
    console.error('[Topics API] 创建主题失败:', error)
    return NextResponse.json(
      { error: '创建主题失败' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    console.log('[Topics API] 开始更新主题')
    const { userId } = auth()
    
    if (!userId) {
      console.log('[Topics API] 未找到用户ID，更新失败')
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    await connectToDatabase()
    const body = await request.json()
    const { name } = body
    
    // 从URL中获取主题ID
    const url = new URL(request.url)
    const topicId = url.pathname.split('/').pop()
    
    console.log(`[Topics API] 更新主题，ID: ${topicId}, 新名称: ${name}`)
    
    const topic = await Topic.findOneAndUpdate(
      { uuid: topicId, userId },
      { name },
      { new: true }
    )
    
    if (!topic) {
      console.log(`[Topics API] 未找到主题或无权限更新，ID: ${topicId}`)
      return NextResponse.json(
        { error: '未找到主题或无权限更新' },
        { status: 404 }
      )
    }
    
    console.log(`[Topics API] 主题更新成功，ID: ${topicId}`)
    return NextResponse.json(topic)
  } catch (error) {
    console.error('[Topics API] 更新主题失败:', error)
    return NextResponse.json(
      { error: '更新主题失败' },
      { status: 500 }
    )
  }
}