'use client'

import { useState, useEffect } from 'react'
import { Todo, Priority, TodoStatus } from '~/models/Todo'

interface TopicSectionProps {
  name: string
  uuid: string
  initialTodos: Todo[] // 添加 initialTodos 属性
  onRename: (newName: string) => void
}

export default function TopicSection({ name, uuid, initialTodos, onRename }: TopicSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(name);
  const [todos, setTodos] = useState<Todo[]>(initialTodos || []);
  const [newTodo, setNewTodo] = useState('');
  const [priority, setPriority] = useState<Priority>(Priority.NONE);
  const [dueDate, setDueDate] = useState<string>('');
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null); // 新增状态来跟踪拖拽的项

  useEffect(() => {
    setTodos(initialTodos || []);
  }, [initialTodos, name]);

  const handleToggleTodoStatus = async (todoId: string) => {
    const todoToUpdate = todos.find(t => t._id === todoId);
    if (!todoToUpdate) return;

    const newStatus = todoToUpdate.status === TodoStatus.COMPLETED ? TodoStatus.PENDING : TodoStatus.COMPLETED;

    try {
      // 这一部分的 fetch 调用是导致 404 错误的地方
      const response = await fetch(`/api/todos/${todoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        // 由于是 404, response.ok 会是 false
        const errorData = await response.json().catch(() => ({ message: '更新待办事项状态失败，且无法解析错误响应' })); // 添加 catch 以防响应体不是 JSON
        throw new Error(errorData.message || '更新待办事项状态失败');
      }

      const updatedTodo = await response.json();

      setTodos(prevTodos => 
        prevTodos.map(t => 
          t._id === todoId ? { ...t, status: updatedTodo.status } : t
        )
      );
    } catch (error) {
      console.error('更新待办事项状态失败:', error);
      // 可以在这里添加用户提示，告知用户后端更新失败
    }
  };

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
            priority: priority, // Corrected: use priority state variable
            dueDate: dueDate || undefined,
          }),
        })

        if (!response.ok) {
          throw new Error('添加待办事项失败')
        }

        const data = await response.json()
        setTodos([...todos, data])
        setNewTodo('')
        setPriority(Priority.NONE) // Corrected: use setPriority
        setDueDate('')
      } catch (error) {
        console.error('添加待办事项失败:', error)
      }
    }
  } // Added missing closing brace for handleAddTodo

  const handleReparentTodo = async (draggedTodoId: string, newParentId: string | null) => {
    console.log(`[TopicSection] Reparenting todo: ${draggedTodoId} to new parent: ${newParentId}`);
    if (draggedTodoId === newParentId) {
      console.warn('Cannot reparent a todo to itself.');
      return;
    }
    try {
      const response = await fetch(`/api/todos/${draggedTodoId}/reparent`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newParentId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: '重置父任务失败，且无法解析错误响应' }));
        throw new Error(errorData.message || '重置父任务失败');
      }

      const updatedTodoFromAPI: Todo = await response.json();

      setTodos(prevTodos =>
        prevTodos.map(todo => {
          if (todo._id === updatedTodoFromAPI._id) {
            // 使用从API返回的更新后的todo数据，特别是更新parentId
            return { ...todo, parentId: updatedTodoFromAPI.parentId };
          }
          return todo;
        })
      );
      
      // 注意：为了完全反映层级变化（包括父级 `children` 数组的更新），
      // 最稳妥的方式是重新获取当前主题下的所有待办事项。
      // 例如: fetchTodosForTopic(uuid).then(setTodos);
      // 上述的 setTodos 调用仅更新了被移动项的 parentId，
      // 其旧父级和新父级的 children 数组在本地状态中可能未同步，除非渲染逻辑能动态构建层级。

    } catch (error) {
      console.error('重置父任务失败:', error);
      // 可以在这里添加用户提示，告知用户后端更新失败
    }
  };

  // 拖放事件处理函数
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, todoId: string) => {
    setDraggedItemId(todoId);
    // 可选：为拖拽元素设置一些视觉效果
    // e.dataTransfer.effectAllowed = 'move';
    // e.dataTransfer.setData('text/plain', todoId); // 某些浏览器可能需要 setData
    console.log(`[DragStart] dragging: ${todoId}`);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // 必须阻止默认行为以允许放置
    // e.dataTransfer.dropEffect = 'move'; // 可选：指示放置类型
  };

  const handleDropOnTodo = (e: React.DragEvent<HTMLDivElement>, targetTodoId: string) => {
    e.preventDefault();
    if (draggedItemId && draggedItemId !== targetTodoId) {
      console.log(`[DropOnTodo] dragged: ${draggedItemId} onto: ${targetTodoId}`);
      handleReparentTodo(draggedItemId, targetTodoId);
    }
    setDraggedItemId(null); // 重置拖拽状态
  };
  
  const handleDropOnRoot = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    // 确保不是在某个子元素上触发的（如果需要更精确的根区域判断）
    // 例如，可以检查 e.target 是否为根容器本身
    if (draggedItemId) {
      console.log(`[DropOnRoot] dragged: ${draggedItemId} to root`);
      handleReparentTodo(draggedItemId, null); // 设置父ID为null，使其成为顶级任务
    }
    setDraggedItemId(null); // 重置拖拽状态
  };


  return (
    <div 
      className="p-6 bg-white dark:bg-zinc-800 rounded-lg shadow"
      onDragOver={handleDragOver} // 允许在整个区域拖放以成为根任务
      onDrop={handleDropOnRoot}   // 处理拖放到根区域的逻辑
    >
      <div className="flex justify-between items-center mb-4">
        {isEditing ? (
          <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            className="text-xl font-semibold text-zinc-800 dark:text-zinc-100 bg-transparent border-b border-zinc-300 dark:border-zinc-600 focus:outline-none focus:border-purple-500"
            autoFocus
          />
        ) : (
          <h2 
            className="text-xl font-semibold text-zinc-800 dark:text-zinc-100 cursor-pointer"
            onClick={() => setIsEditing(true)}
          >
            {name}
          </h2>
        )}
        {/* 可以添加删除主题的按钮等 */}
      </div>

      {/* 渲染 Todos 列表 */}
      <div className="space-y-3 mb-4">
        {todos && todos.length > 0 ? (
          todos.map((todo) => (
            <div 
              key={todo._id} 
              className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-700 rounded-md"
              draggable="true" // 使整个 todo 项可拖拽
              onDragStart={(e) => handleDragStart(e, todo._id)}
              onDragOver={handleDragOver} // 允许在其上拖放
              onDrop={(e) => handleDropOnTodo(e, todo._id)} // 处理拖放到此 todo 上的逻辑
            >
              <div className="flex items-center">
                {/* 拖拽句柄图标 */}
                <div 
                  className="mr-2 cursor-grab text-zinc-400 hover:text-zinc-600"
                  title="拖拽以排序或改变层级"
                  // 如果只想让句柄可拖拽，而不是整个项，可以将 draggable 和 onDragStart 移到这里
                  // draggable="true"
                  // onDragStart={(e) => handleDragStart(e, todo._id)}
                >
                  ☰ {/* 简单的拖拽图标 */}
                </div>
                <input
                  type="checkbox"
                  checked={todo.status === TodoStatus.COMPLETED}
                  onChange={() => handleToggleTodoStatus(todo._id)}
                  className="mr-3 h-5 w-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 dark:bg-zinc-600 dark:border-zinc-500"
                />
                <span className={`text-sm ${todo.status === TodoStatus.COMPLETED ? 'line-through text-zinc-500 dark:text-zinc-400' : 'text-zinc-800 dark:text-zinc-100'}`}>
                  {todo.content}
                </span>
              </div>
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                todo.status === TodoStatus.COMPLETED 
                  ? 'bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100' 
                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-700 dark:text-yellow-100'
              }`}>
                {todo.status}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">该主题下还没有待办事项。</p>
        )}
      </div>

      {/* 添加新的 Todo 输入区域 */}
      <div className="mt-4">
        <input
            type="text"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            placeholder="添加新的待办事项..."
            className="flex-1 px-3 py-2 rounded-lg border dark:border-zinc-700 dark:bg-zinc-800"
          />
          <select
            value={priority} // Corrected: use priority state variable
            onChange={(e) => setPriority(e.target.value as Priority)} // Corrected: use setPriority
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
      </div> // 这是最外层 div 的闭合标签
    // 移除了这里多余的 </div>
  )
}