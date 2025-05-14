'use client'

import { useState, useEffect } from 'react'
import { Todo, Priority, TodoStatus } from '~/models/Todo'

interface TopicSectionProps {
  name: string
  uuid: string
  onRename: (newName: string) => void
}

export default function TopicSection({ name, uuid, onRename }: TopicSectionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(name)
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTodo, setNewTodo] = useState('')
  const [selectedPriority, setSelectedPriority] = useState<Priority>(Priority.NONE)
  const [dueDate, setDueDate] = useState<string>('')

  useEffect(() => {
    const fetchTodos = async () => {
      try {
        const response = await fetch(`/api/todos?topicId=${uuid}`)
        if (response.ok) {
          const data = await response.json()
          setTodos(data)
        }
      } catch (error) {
        console.error('获取待办事项失败:', error)
      }
    }
    
    fetchTodos()
  }, [uuid])

  const handleRename = async () => {
    const trimmedName = editedName.trim()
    if (trimmedName && trimmedName !== name) {
      try {
        const response = await fetch(`/api/topics/${uuid}`, {  // 修改为正确的API路径
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: trimmedName }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || '重命名失败')
        }

        onRename(trimmedName)
        setIsEditing(false)
      } catch (error) {
        console.error('重命名失败:', error)
        setEditedName(name)
        setIsEditing(false)
      }
    } else {
      setIsEditing(false)
      setEditedName(name)
    }
  }

  const handleCancelRename = () => {
    setIsEditing(false)
    setEditedName(name)
  }

  const handleAddTodo = async () => {
    if (newTodo.trim()) {
      try {
        const response = await fetch('/api/todos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: newTodo.trim(),
            topicId: uuid,
            priority: selectedPriority,
            dueDate: dueDate || undefined,
          }),
        })

        if (!response.ok) {
          throw new Error('添加待办事项失败')
        }

        const data = await response.json()
        setTodos([...todos, data])
        setNewTodo('')
        setSelectedPriority(Priority.NONE)
        setDueDate('')
      } catch (error) {
        console.error('添加待办事项失败:', error)
      }
    }
  }

  return (
    <div className="p-6 bg-white dark:bg-zinc-800 rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-4">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="px-2 py-1 border rounded dark:bg-zinc-700 dark:border-zinc-600"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRename()
                } else if (e.key === 'Escape') {
                  handleCancelRename()
                }
              }}
              onBlur={handleRename}
            />
          </div>
        ) : (
          <div 
            className="group flex items-center gap-2 cursor-pointer"
            onClick={() => setIsEditing(true)}
          >
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              {name}
            </h2>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-sm text-zinc-500">
              点击编辑
            </span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Todo列表 */}
        <div className="space-y-2">
          {todos.map((todo) => (
            <div
              key={todo._id}
              className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={todo.status === TodoStatus.COMPLETED}
                  onChange={async () => {
                    const newStatus = todo.status === TodoStatus.COMPLETED
                      ? TodoStatus.PENDING
                      : TodoStatus.COMPLETED
                    
                    await fetch(`/api/todos/${todo._id}`, {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ status: newStatus }),
                    })

                    setTodos(todos.map(t => 
                      t._id === todo._id ? { ...t, status: newStatus } : t
                    ))
                  }}
                  className="h-4 w-4 rounded border-zinc-300 text-purple-600 focus:ring-purple-600"
                />
                <span className={`${todo.status === TodoStatus.COMPLETED ? 'line-through text-zinc-500' : ''}`}>
                  {todo.content}
                </span>
                {todo.priority !== Priority.NONE && (
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    todo.priority === Priority.P00 ? 'bg-red-100 text-red-800' :
                    todo.priority === Priority.P0 ? 'bg-orange-100 text-orange-800' :
                    todo.priority === Priority.P1 ? 'bg-yellow-100 text-yellow-800' :
                    todo.priority === Priority.P2 ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {todo.priority}
                  </span>
                )}
                {todo.dueDate && (
                  <span className="text-sm text-zinc-500">
                    {new Date(todo.dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>
              <button
                onClick={async () => {
                  await fetch(`/api/todos/${todo._id}`, {
                    method: 'DELETE',
                  })
                  setTodos(todos.filter(t => t._id !== todo._id))
                }}
                className="text-zinc-400 hover:text-zinc-600"
              >
                删除
              </button>
            </div>
          ))}
        </div>

        {/* 添加新Todo的表单 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            placeholder="添加新的待办事项..."
            className="flex-1 px-3 py-2 rounded-lg border dark:border-zinc-700 dark:bg-zinc-800"
          />
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value as Priority)}
            className="px-3 py-2 rounded-lg border dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value={Priority.NONE}>无优先级</option>
            <option value={Priority.P00}>P00</option>
            <option value={Priority.P0}>P0</option>
            <option value={Priority.P1}>P1</option>
            <option value={Priority.P2}>P2</option>
            <option value={Priority.P3}>P3</option>
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="px-3 py-2 rounded-lg border dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button
            onClick={handleAddTodo}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  )
}