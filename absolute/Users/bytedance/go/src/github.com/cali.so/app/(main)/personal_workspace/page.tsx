// ... existing code ...
import { useState, useEffect } from 'react'
import { Container } from '~/components/ui/Container'
import { motion } from 'framer-motion'
import TopicSection from './components/TopicSection'
import { Todo } from '~/models/Todo'; // 假设 Todo 类型定义在这里或可导入

// ... existing code ...

interface TopicWithTodos {
  name: string;
  uuid: string;
  _id: string; // 假设 API 返回 _id
  createdAt: string; // 假设 API 返回 createdAt
  updatedAt: string; // 假设 API 返回 updatedAt
  todos: Todo[]; // 添加 todos 属性
}

function WorkspaceContent() {
  const [topics, setTopics] = useState<Array<TopicWithTodos>>([])
  const [showNewTopicModal, setShowNewTopicModal] = useState(false)
// ... existing code ...
  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const response = await fetch('/api/topics') // 在这里调用 /api/topics
        if (!response.ok) {
          throw new Error('获取主题列表失败')
        }
        const data = await response.json()
        setTopics(data)
      } catch (error) {
        console.error('获取主题列表失败:', error)
      }
    }

    fetchTopics()
  }, []) // 空依赖数组意味着这个 effect 只在组件初次渲染时运行

  const handleCreateTopic = async () => {
    if (newTopicName.trim()) {
      try {
        const response = await fetch('/api/topics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: newTopicName.trim() }),
        })

        if (!response.ok) {
          throw new Error('创建主题失败')
        }

        const newTopicData = await response.json()
        // 新创建的 topic 可能还没有 todos，或者 API 返回时已包含空的 todos 数组
        setTopics([...topics, { ...newTopicData, todos: newTopicData.todos || [] }])
        setNewTopicName('')
        setShowNewTopicModal(false)
      } catch (error) {
        console.error('创建主题失败:', error)
      }
    }
  }

  return (
    <div className="space-y-8">
// ... existing code ...
        <>
          {topics.map((topic) => (
            <TopicSection
              key={topic.uuid}
              name={topic.name}
              uuid={topic.uuid}
              initialTodos={topic.todos} // 传递 todos
              onRename={(newName) => {
                setTopics(topics.map(t => 
                  t.uuid === topic.uuid ? { ...t, name: newName } : t
                ))
              }}
            />
          ))}
          <button
// ... existing code ...