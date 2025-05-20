import { auth } from '@clerk/nextjs'
import { NextResponse } from 'next/server'

import { connectToDatabase } from '~/lib/mongodb'
import { Topic } from '~/models/Topic'

export async function PUT(
  request: Request,
  { params }: { params: { uuid: string } }
) {
  try {
    console.log('[Topics API] PUT /api/topics/[uuid] - 开始更新主题');
    const { userId } = auth()
    
    if (!userId) {
      console.log('[Topics API] PUT /api/topics/[uuid] - 未找到用户ID，更新失败');
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    await connectToDatabase()
    const body = await request.json()
    const { name } = body
    
    console.log(`[Topics API] PUT /api/topics/[uuid] - 更新主题，UUID: ${params.uuid}, 新名称: ${name}, 用户ID: ${userId}`);
    
    const topic = await Topic.findOneAndUpdate(
      { uuid: params.uuid, userId }, // 确保用户拥有该主题
      { name },
      { new: true }
    )
    
    if (!topic) {
      console.log(`[Topics API] PUT /api/topics/[uuid] - 未找到主题或无权限更新，UUID: ${params.uuid}, 用户ID: ${userId}`);
      return NextResponse.json(
        { error: '未找到主题或无权限更新' },
        { status: 404 } // 如果主题未找到或不属于该用户，API会返回404
      )
    }
    
    console.log(`[Topics API] PUT /api/topics/[uuid] - 主题更新成功，UUID: ${params.uuid}`);
    return NextResponse.json(topic)
  } catch (error) {
    console.error('[Topics API] PUT /api/topics/[uuid] - 更新主题失败:', error);
    return NextResponse.json(
      { error: '更新主题失败' },
      { status: 500 }
    )
  }
}