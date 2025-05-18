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
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [expandedTodos, setExpandedTodos] = useState<Record<string, boolean>>({}); // 新增状态：todoId -> isExpanded

  useEffect(() => {
    setTodos(initialTodos || []);
    // 可选：根据 initialTodos 初始化 expandedTodos，例如默认全部折叠或展开
    const initialExpandedState: Record<string, boolean> = {};
    initialTodos.forEach(todo => {
      // 检查这个 todo 是否有子项
      if (initialTodos.some(child => child.parentId === todo._id)) {
        initialExpandedState[todo._id] = true; // 默认展开有子项的
      }
    });
    setExpandedTodos(initialExpandedState);
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

      // 当一个 todo 被移动后，如果它成为了新的父项，可以考虑默认展开它
      if (newParentId) {
        // setExpandedTodos(prev => ({ ...prev, [newParentId]: true }));
      }
      // 如果被拖拽的项之前是展开的，并且不再有子项（或被移走），可能需要更新其展开状态
      // 这个逻辑可以根据具体需求细化

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
    e.stopPropagation(); // 防止事件冒泡到父级或其他拖放区域
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

  // 新增：切换待办事项展开/折叠状态的函数
  const toggleExpandTodo = (todoId: string) => {
    setExpandedTodos(prev => ({
      ...prev,
      [todoId]: !prev[todoId] // 如果是 undefined 或 false，则变为 true；如果是 true，则变为 false
    }));
  };

  // 递归渲染函数，用于展示层级关系的 todos
  const renderTodoItem = (todo: Todo, level: number) => {
    const children = todos.filter(childTodo => childTodo.parentId === todo._id);
    const indentation = level * 20; // 每层缩进 20px
    const isExpanded = expandedTodos[todo._id] === true; // 明确检查 true，undefined 视为折叠

    return (
      <div key={todo._id}>
        <div
          className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-700 rounded-md"
          style={{ marginLeft: `${indentation}px` }} // 应用缩进
          draggable="true"
          onDragStart={(e) => handleDragStart(e, todo._id)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDropOnTodo(e, todo._id)}
        >
          <div className="flex items-center flex-grow"> {/* 使用 flex-grow 使内容区占据剩余空间 */}
            {/* 折叠/展开图标 */}
            {children.length > 0 && (
              <span 
                onClick={() => toggleExpandTodo(todo._id)} 
                className="mr-2 cursor-pointer text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                title={isExpanded ? "折叠" : "展开"}
              >
                {isExpanded ? '▼' : '▶'} {/* 使用简单字符作为图标 */}
              </span>
            )}
            {/* 如果没有子项，但仍想保持对齐，可以放一个占位符 */}
            {children.length === 0 && <span className="mr-2 w-[1em] inline-block"></span>} 
            
            <div
              className="mr-2 cursor-grab text-zinc-400 hover:text-zinc-600"
              title="拖拽以排序或改变层级"
            >
              ☰
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
        {/* 递归渲染子待办事项，仅当父项展开时 */}
        {isExpanded && children.length > 0 && (
          <div className="mt-1"> 
            {children.map(child => renderTodoItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // 筛选出顶层待办事项 (没有 parentId 的)
  const rootTodos = todos.filter(todo => !todo.parentId);

  return (
    <div 
      className="p-6 bg-white dark:bg-zinc-800 rounded-lg shadow"
      onDragOver={handleDragOver} 
      onDrop={handleDropOnRoot}   
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
        {rootTodos.length > 0 ? (
          rootTodos.map((todo) => renderTodoItem(todo, 0)) // 从 level 0 开始渲染顶层 todo
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
      </div> 
  )
}