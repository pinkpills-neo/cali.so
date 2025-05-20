'use client'

import { useEffect,useState } from 'react'

import { Priority, type Todo, TodoStatus } from '~/models/Todo'

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

  // 新增状态：用于行内编辑 (请添加下面这几行)
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [currentEditContent, setCurrentEditContent] = useState<string>('');
  const [currentEditPriority, setCurrentEditPriority] = useState<Priority>(Priority.NONE);
  const [currentEditDueDate, setCurrentEditDueDate] = useState<string>(''); // 存储 YYYY-MM-DD格式
  const [editingField, setEditingField] = useState<'content' | 'priority' | 'dueDate' | null>(null); // 新增状态

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

  // 新增：格式化截止日期显示的辅助函数
  const formatDateDisplay = (dueDateString: string | Date | undefined | null): string => {
    if (!dueDateString) {
      return '';
    }

    let targetDate: Date;
    if (typeof dueDateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDateString)) {
      const [year, month, day] = dueDateString.split('-').map(Number);
      // L203, L207: Ensure map(Number) results are treated as numbers for Date constructor
      targetDate = new Date(year, month - 1, day);
    } else {
      targetDate = new Date(dueDateString);
    }

    if (isNaN(targetDate.getTime())) {
        return '无效日期';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // 将今天的日期设置为午夜，以便比较

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // 明天的日期
    
    // 为了比较，获取目标日期的午夜时间版本
    const targetDateAtMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

    if (targetDateAtMidnight.getTime() === today.getTime()) {
      return '今天';
    }
    if (targetDateAtMidnight.getTime() === tomorrow.getTime()) {
      return '明天';
    }

    // 其他情况，显示具体日期
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1; // 月份转为 1-indexed
    const day = targetDate.getDate();

    if (year === today.getFullYear()) { // 如果是今年，不显示年份
      return `${month}月${day}日`;
    } else { // 否则显示完整年月日
      return `${year}年${month}月${day}日`;
    }
  };

  // 辅助函数：获取优先级的数值，用于排序 (数值越小，优先级越高)
  const getPriorityValue = (priority: Priority | undefined): number => {
    if (!priority) return 5; // 如果没有定义优先级，视为最低
    switch (priority) {
      case Priority.P00: return 0;
      case Priority.P0: return 1;
      case Priority.P1: return 2;
      case Priority.P2: return 3;
      case Priority.P3: return 4;
      case Priority.NONE: return 5;
      default: return 5; // 其他未知情况也视为最低
    }
  };

  // 辅助函数：按优先级和状态排序 Todos
  const sortByStatus = (a: Todo, b: Todo) => {
    const priorityValueA = getPriorityValue(a.priority);
    const priorityValueB = getPriorityValue(b.priority);


    // 1. 则按状态排序 (未完成的在前，已完成的在后)
    if (a.status === TodoStatus.COMPLETED && b.status !== TodoStatus.COMPLETED) {
      return 1; // a (completed) 应该在 b (pending) 之后
    }
    if (a.status !== TodoStatus.COMPLETED && b.status === TodoStatus.COMPLETED) {
      return -1; // a (pending) 应该在 b (completed) 之前
    }
    
    // 2. 按优先级排序
    if (priorityValueA !== priorityValueB) {
      return priorityValueA - priorityValueB; // 值小的（优先级高）在前
    }

        
    // 3. 如果优先级和状态都相同，可以根据创建时间或其他字段排序，或者保持原有顺序
    // 例如，按创建时间升序 (如果需要):
    // if (a.createdAt && b.createdAt) {
    //   return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    // }
    return 0; // 优先级和状态都相同，顺序不变
  };

  const startEditingTodo = (todo: Todo, field: 'content' | 'priority' | 'dueDate') => {
    setEditingTodoId(todo._id);
    setEditingField(field); // 设置当前编辑的字段
    setCurrentEditContent(todo.content);
    setCurrentEditPriority(todo.priority);
    if (todo.dueDate) {
      const date = new Date(todo.dueDate);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      setCurrentEditDueDate(`${year}-${month}-${day}`);
    } else {
      setCurrentEditDueDate('');
    }
  };

  const cancelEditingTodo = () => {
    setEditingTodoId(null);
    setEditingField(null); // <--- 添加: 重置当前编辑的字段
    setCurrentEditContent('');
    setCurrentEditPriority(Priority.NONE);
    setCurrentEditDueDate('');
  };

  // 修正 handleSaveTodoEdits 以支持按字段保存
  const handleSaveTodoEdits = async (todoId: string, fieldToSave?: 'content' | 'priority' | 'dueDate') => {
    const currentField = fieldToSave || editingField;

    if (!editingTodoId || editingTodoId !== todoId || !currentField) {
      if (editingTodoId === todoId && !fieldToSave && !editingField) {
        // Blur 触发，但 editingField 已被取消
      } else if (editingTodoId === todoId && fieldToSave && editingField && fieldToSave !== editingField) {
        // Blur 触发了一个字段的保存，但当前正在编辑的是另一个字段
        return;
      }
      return;
    }

    const originalTodo = todos.find(t => t._id === todoId);
    if (!originalTodo) {
      console.error('Original todo not found for editing. Cancelling edit.');
      cancelEditingTodo();
      return;
    }

    const payload: Partial<Pick<Todo, 'content' | 'priority' | 'dueDate'>> = {};
    let changed = false;

    if (currentField === 'content') {
      const trimmedContent = currentEditContent.trim();
      if (trimmedContent === '') {
        console.warn('Todo content cannot be empty. Edit not saved.');
        return; // 保持编辑状态让用户修正
      }
      if (trimmedContent !== originalTodo.content) {
        payload.content = trimmedContent;
        changed = true;
      }
    } else if (currentField === 'priority') {
      if (currentEditPriority !== originalTodo.priority) {
        payload.priority = currentEditPriority;
        changed = true;
      }
    } else if (currentField === 'dueDate') {
      let originalDueDateString = '';
      if (originalTodo.dueDate) {
        // 将原始截止日期也格式化为 YYYY-MM-DD 以便比较
        let tempDate;
        if (typeof originalTodo.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(originalTodo.dueDate)) {
            const [y, m, d] = originalTodo.dueDate.split('-').map(Number);
            tempDate = new Date(y, m - 1, d);
        } else {
            tempDate = new Date(originalTodo.dueDate);
        }
        if (!isNaN(tempDate.getTime())) {
            const year = tempDate.getFullYear();
            const month = (tempDate.getMonth() + 1).toString().padStart(2, '0');
            const day = tempDate.getDate().toString().padStart(2, '0');
            originalDueDateString = `${year}-${month}-${day}`;
        }
      }
      // currentEditDueDate 已经是 'YYYY-MM-DD' 或 ''
      if (currentEditDueDate !== originalDueDateString) {
        payload.dueDate = currentEditDueDate ? currentEditDueDate : null; // 如果为空字符串，则发送 null 以清除日期
        changed = true;
      }
    }

    if (!changed) {
      cancelEditingTodo();
      return;
    }

    try {
      const response = await fetch(`/api/todos/${todoId}`, {
        method: 'PUT', 
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload), // 只发送更改的字段
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `更新待办事项 ${currentField} 失败，且无法解析错误响应` }));
        throw new Error(errorData.message || `更新待办事项 ${currentField} 失败`);
      }

      const updatedTodoFromAPI = await response.json();

      setTodos(prevTodos =>
        prevTodos.map(t =>
          t._id === todoId ? { ...t, ...updatedTodoFromAPI } : t
        )
      );

      cancelEditingTodo(); 
    } catch (error) {
      console.error(`保存待办事项 ${currentField} 编辑失败:`, error);
    }
  };

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


  // 新增：处理删除待办事项的函数
  const handleDeleteTodo = async (todoId: string) => {
    if (!confirm('确定要删除这个待办事项及其所有子项吗？')) {
      return;
    }

    try {
      const response = await fetch(`/api/todos/${todoId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('删除待办事项失败');
      }

      // 更新本地状态，移除被删除的待办事项及其所有子项
      setTodos(prevTodos => {
        const removeTodoAndChildren = (todoId: string): string[] => {
          const childrenIds = prevTodos
            .filter(t => t.parentId === todoId)
            .map(t => t._id);
          
          return [todoId, ...childrenIds.flatMap(removeTodoAndChildren)];
        };

        const idsToRemove = removeTodoAndChildren(todoId);
        return prevTodos.filter(todo => !idsToRemove.includes(todo._id));
      });

    } catch (error) {
      console.error('删除待办事项失败:', error);
      alert('删除待办事项失败，请稍后重试');
    }
  };

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
    const children = todos
      .filter(childTodo => childTodo.parentId === todo._id)
      .sort(sortByStatus); // 在这里对子项进行排序 (现在会使用外部定义的 sortByStatus)
    const indentation = level * 20;
    
    // 这个标记整个条目是否处于任何编辑状态（用于通用样式和禁用某些操作）
    const isAnyFieldEditing = editingTodoId === todo._id;

    const isExpanded = todo.status === TodoStatus.COMPLETED && !isAnyFieldEditing // 如果完成且不在编辑，则折叠
      ? false 
      : expandedTodos[todo._id] === true;

    // SVG 图标组件
    // 用于“未折叠”状态 (isExpanded = true)，显示向下箭头，点击可折叠
    const IconChevronDown = () => (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24" 
        strokeWidth="1.5" 
        stroke="currentColor" 
        className="size-4" // Tailwind class for size (e.g., w-4 h-4)
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
      </svg>
    );

    // 用于“折叠”状态 (isExpanded = false)，显示向右箭头，点击可展开
    const IconChevronRight = () => (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24" 
        strokeWidth="1.5" 
        stroke="currentColor" 
        className="size-4" // Tailwind class for size (e.g., w-4 h-4)
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" /> 
      </svg>
    );

    // 新增：垃圾桶图标组件
    const IconTrash = () => (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 opacity-15 hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    );

  
    const IconCheckboxUnchecked = () => (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24" 
        strokeWidth="1.5" 
        stroke="currentColor" 
        className="size-5 text-gray-400 dark:text-gray-500" // 尺寸和颜色
      >
        <rect x="4.5" y="4.5" width="15" height="15" rx="2" strokeWidth="1.5"/>
      </svg>
    );

    const IconCheckboxChecked = () => (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="currentColor" // 使用 fill 来填充背景
        className="size-5 text-gray-300 dark:text-gray-600" // 方框背景色
      >
        {/* 背景方框 (轻微圆角) */}
        <rect x="4.5" y="4.5" width="15" height="15" rx="2" />
        {/* 对勾图标 (颜色通过父级 text-gray-500 dark:text-gray-400 控制) */}
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          d="M7.5 12l3 3 6-6" 
          strokeWidth="2.5" // 加粗一点对勾
          stroke="white" // 对勾用白色，使其在灰色背景上可见
          fill="none" // 对勾本身不填充
        /> 
      </svg>
    );


    return (
      <div key={todo._id}>
        <div
          className={`flex items-center justify-between p-3 rounded-md ${isAnyFieldEditing ? 'bg-zinc-100 dark:bg-zinc-600 shadow-lg' : 'bg-zinc-50 dark:bg-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-600'}`}
          style={{ marginLeft: `${indentation}px` }}
          draggable={!isAnyFieldEditing}
          onDragStart={(e) => !isAnyFieldEditing && handleDragStart(e, todo._id)}
          onDragOver={handleDragOver}
          onDrop={(e) => !isAnyFieldEditing && handleDropOnTodo(e, todo._id)}
        >
          <div className="flex items-center flex-grow min-w-0"> {/* 左侧和中间内容 */}
            {/* 折叠/展开图标 */}
            {children.length > 0 && (
              <span 
                onClick={() => !isAnyFieldEditing && toggleExpandTodo(todo._id)} 
                className={`mr-2 flex items-center justify-center ${isAnyFieldEditing ? 'cursor-not-allowed text-zinc-400' : 'cursor-pointer text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
                title={isExpanded ? "折叠" : "展开"}
              >
                {isExpanded ? <IconChevronDown /> : <IconChevronRight />}
              </span>
            )}
            {children.length === 0 && <span className="mr-2 w-4 inline-block h-4"></span>}
            
            <div
              className={`mr-2 text-zinc-400 ${isAnyFieldEditing ? 'cursor-not-allowed' : 'cursor-grab hover:text-zinc-600'}`}
              title={isAnyFieldEditing ? "" : "拖拽以排序或改变层级"}
            >
              ☰
            </div>
            {/* 自定义复选框 */}
            <span
              onClick={() => !isAnyFieldEditing && handleToggleTodoStatus(todo._id)}
              className={`mr-3 flex items-center justify-center ${isAnyFieldEditing ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              role="checkbox"
              aria-checked={todo.status === TodoStatus.COMPLETED}
              tabIndex={isAnyFieldEditing ? -1 : 0}
              onKeyDown={(e) => { if (!isAnyFieldEditing && (e.key === ' ' || e.key === 'Enter')) handleToggleTodoStatus(todo._id); }}
            >
              {todo.status === TodoStatus.COMPLETED ? <IconCheckboxChecked /> : <IconCheckboxUnchecked />}
            </span>

            {/* 内容 */}
            {isAnyFieldEditing && editingField === 'content' ? (
              <input
                type="text"
                value={currentEditContent}
                onChange={(e) => setCurrentEditContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSaveTodoEdits(todo._id, 'content'); // L426: Add void
                  if (e.key === 'Escape') cancelEditingTodo();
                }}
                onBlur={() => void handleSaveTodoEdits(todo._id, 'content')} // L437: Add void
                autoFocus
                className="flex-grow text-sm bg-transparent border-b border-purple-500 dark:border-purple-400 focus:outline-none mr-2 min-w-[100px]"
              />
            ) : (
              <span 
                onClick={() => startEditingTodo(todo, 'content')}
                className={`text-sm flex-grow mr-2 min-w-0 truncate ${todo.status === TodoStatus.COMPLETED ? 'line-through text-zinc-500 dark:text-zinc-400' : 'text-zinc-800 dark:text-zinc-100'} ${isAnyFieldEditing && editingField !== 'content' ? 'opacity-50' : 'cursor-pointer'}`}
                title={todo.content}
              >
                {todo.content}
              </span>
            )}

            {/* 优先级 */}
            {isAnyFieldEditing && editingField === 'priority' ? (
              <select
                value={currentEditPriority}
                onChange={(e) => {
                  setCurrentEditPriority(e.target.value as Priority);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') cancelEditingTodo();
                }}
                onBlur={() => void handleSaveTodoEdits(todo._id, 'priority')} // L565: Add void
                autoFocus
                className="ml-2 px-1 py-0.5 text-xs rounded-md border border-purple-500 dark:border-purple-400 dark:bg-zinc-700 focus:outline-none"
              >
                <option value={Priority.NONE}>无</option>
                <option value={Priority.P00}>P00</option>
                <option value={Priority.P0}>P0</option>
                <option value={Priority.P1}>P1</option>
                <option value={Priority.P2}>P2</option>
                <option value={Priority.P3}>P3</option>
              </select>
            ) : (
              <>
                {todo.priority && todo.priority !== Priority.NONE && (
                  <span 
                    onClick={() => startEditingTodo(todo, 'priority')}
                    className={`ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-700 dark:text-blue-100 whitespace-nowrap ${isAnyFieldEditing && editingField !== 'priority' ? 'opacity-50' : 'cursor-pointer'}`}
                  >
                    {todo.priority}
                  </span>
                )}
                {(!todo.priority || todo.priority === Priority.NONE) && (
                  <span
                      onClick={() => startEditingTodo(todo, 'priority')}
                      className={`ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 ${isAnyFieldEditing && editingField !== 'priority' ? 'opacity-50' : 'cursor-pointer'}`}
                  >
                      无优先级
                  </span>
                )}
              </>
            )}
          </div>

          {/* 截止日期 */}
          <div className="flex-shrink-0 ml-2 flex items-center"> {/* Added flex items-center */}
            {isAnyFieldEditing && editingField === 'dueDate' ? (
              <input
                type="date"
                value={currentEditDueDate} // YYYY-MM-DD
                onChange={(e) => setCurrentEditDueDate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSaveTodoEdits(todo._id, 'dueDate'); // L648: Add void
                  if (e.key === 'Escape') cancelEditingTodo();
                }}
                onBlur={() => void handleSaveTodoEdits(todo._id, 'dueDate')} // L577: (Mistake in log, should be around here) Add void
                autoFocus
                className="px-1 py-0.5 text-xs rounded-md border border-purple-500 dark:border-purple-400 dark:bg-zinc-700 focus:outline-none"
              />
            ) : (
              todo.dueDate ? (
                <span 
                  onClick={() => startEditingTodo(todo, 'dueDate')}
                  className={`text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap ${isAnyFieldEditing && editingField !== 'dueDate' ? 'opacity-50' : 'cursor-pointer'}`}
                >
                  {formatDateDisplay(todo.dueDate)} {/* <--- 使用新的格式化函数 */}
                </span>
              ) : (
                <span 
                  onClick={() => startEditingTodo(todo, 'dueDate')}
                  className={`px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 whitespace-nowrap ${isAnyFieldEditing && editingField !== 'dueDate' ? 'opacity-50' : 'cursor-pointer'}`}
                >
                  DDL
                </span>
              )
            )}
            {/* 操作按钮等其他可能使用编辑状态的地方 */}
            {/* 假设这里是第 586 行附近的代码 */}
            {isAnyFieldEditing && ( // <--- 修改这里：将 isCurrentlyEditing 替换为 isAnyFieldEditing
              <div className="ml-auto flex items-center space-x-2">
                {/* 可能的保存或取消按钮，或者其他仅在编辑时显示的元素 */}
                {/* 例如:
                <button 
                  onClick={() => handleSaveTodoEdits(todo._id, editingField || undefined)} 
                  className="p-1 text-green-500 hover:text-green-700"
                  title="保存"
                >
                  <svg className="size-4" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"></path></svg>
                </button>
                <button 
                  onClick={cancelEditingTodo} 
                  className="p-1 text-red-500 hover:text-red-700"
                  title="取消"
                >
                  <svg className="size-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                </button>
                */}
              </div>
            )}
          </div>

          {/* 删除按钮 */}
          {!isAnyFieldEditing && (
            <button
              onClick={() => void handleDeleteTodo(todo._id)}
              className="ml-3 p-1 text-gray-400 hover:text-red-500 focus:outline-none flex-shrink-0"
              title="删除待办事项"
              aria-label="删除待办事项"
            >
              <IconTrash />
            </button>
          )}

        </div>
        {isExpanded && children.length > 0 && (
          <div className={`mt-1 overflow-hidden transition-all duration-200 ease-in-out ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            {children.map(childTodo => renderTodoItem(childTodo, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // 筛选出顶层待办事项 (没有 parentId 的) 并排序
  const rootTodos = todos
    .filter(todo => !todo.parentId)
    .sort(sortByStatus); // 在这里对根级待办事项进行排序

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
          rootTodos.map((todo) => renderTodoItem(todo, 0))
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
            onKeyDown={(e) => { // 新增 onKeyDown 事件处理器
              if (e.key === 'Enter') {
                handleAddTodo();
              }
            }}
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