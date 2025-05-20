'use client'

import { motion } from 'framer-motion'
import { useEffect,useState } from 'react'

import { Container } from '~/components/ui/Container'

import TopicSection from './components/TopicSection'

export default function PersonalWorkspacePage() {
  return (
    <Container className="mt-16 sm:mt-32">
      <header className="max-w-2xl">
        <motion.h1 
          className="text-4xl font-bold tracking-tight text-zinc-800 dark:text-zinc-100 sm:text-5xl bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 bg-clip-text text-transparent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          个人工作台
        </motion.h1>
      </header>
      <div className="mt-16">
        <WorkspaceContent />
      </div>
    </Container>
  )
}

function WorkspaceContent() {
  const [topics, setTopics] = useState<Array<TopicWithTodos>>([])
  const [showNewTopicModal, setShowNewTopicModal] = useState(false)
  const [newTopicName, setNewTopicName] = useState('')
  
  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const response = await fetch('/api/topics') 
        if (!response.ok) {
          throw new Error('获取主题列表失败')
        }
        const data = await response.json()
        console.log('[WorkspaceContent] Fetched topics data from API:', data);
        setTopics(data)
      } catch (error) {
        console.error('获取主题列表失败:', error)
      }
    }

    fetchTopics()
  }, []) 

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

        const data = await response.json()
        setTopics([...topics, data])
        setNewTopicName('')
        setShowNewTopicModal(false)
      } catch (error) {
        console.error('创建主题失败:', error)
      }
    }
  }

  return (
    <div className="space-y-8">
      {topics.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-zinc-600 dark:text-zinc-400">
            还没有创建任何工作项，开始创建一个吧！
          </p>
          <button
            onClick={() => setShowNewTopicModal(true)}
            className="mt-4 px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors dark:bg-zinc-700 dark:hover:bg-zinc-600"
          >
            创建新主题
          </button>
        </div>
      ) : (
        <>
          {topics.map((topic) => (
            <TopicSection
              key={topic.uuid}
              name={topic.name}
              uuid={topic.uuid}
              initialTodos={topic.todos} // <--- 确保这一行存在并且正确传递了 topic.todos
              onRename={(newName) => {
                setTopics(topics.map(t => 
                  t.uuid === topic.uuid ? { ...t, name: newName } : t
                ))
              }}
            />
          ))}
          <button
            onClick={() => setShowNewTopicModal(true)}
            className="block w-full p-4 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            + 添加新主题
          </button>
        </>
      )}

      {showNewTopicModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-xl">
            <h3 className="text-lg font-medium mb-4">创建新工作区</h3>
            <input
              type="text"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              placeholder="输入工作区名称"
              className="w-full px-3 py-2 border rounded-lg mb-4 dark:bg-zinc-700 dark:border-zinc-600"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTopic()}
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowNewTopicModal(false)
                  setNewTopicName('')
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400"
              >
                取消
              </button>
              <button
                onClick={handleCreateTopic}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}