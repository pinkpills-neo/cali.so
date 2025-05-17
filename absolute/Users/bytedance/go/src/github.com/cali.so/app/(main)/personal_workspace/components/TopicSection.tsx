// ... existing code ...
import { Todo, Priority, TodoStatus } from '~/models/Todo'

interface TopicSectionProps {
  name: string
  uuid: string
  initialTodos: Todo[] // 添加 initialTodos 属性
  onRename: (newName: string) => void
}

export default function TopicSection({ name, uuid, initialTodos, onRename }: TopicSectionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(name)
  const [todos, setTodos] = useState<Todo[]>(initialTodos) // 使用 initialTodos 初始化
  const [newTodo, setNewTodo] = useState('')
// ... existing code ...
  const [dueDate, setDueDate] = useState<string>('')

  // 移除 useEffect 来获取 todos，因为它们现在通过 props 传递
  // useEffect(() => {
  //   const fetchTodos = async () => {
  //     try {
  //       const response = await fetch(`/api/todos?topicId=${uuid}`)
  //       if (response.ok) {
  //         const data = await response.json()
  //         setTodos(data)
  //       }
  //     } catch (error) {
  //       console.error('获取待办事项失败:', error)
  //     }
  //   }
    
  //   fetchTodos()
  // }, [uuid])

  const handleRename = async () => {
// ... existing code ...