"use client"

import type React from "react"

import { useReducer, useState, createContext, useContext, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { CalendarIcon, Filter, SortAsc, Plus, Trash, Search, TagIcon, BarChart2, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"

// Task type definition
type TaskTag = {
  id: string
  name: string
  color: string
}

type Task = {
  id: string
  name: string
  description: string
  dueDate: Date
  completed: boolean
  priority: number
  tags: string[] // Tag IDs
  createdAt: Date
  completedAt: Date | null
  position: number // For drag and drop ordering
}

// Action types for the reducer
type TaskAction =
  | { type: "ADD_TASK"; payload: Task }
  | { type: "TOGGLE_TASK"; payload: { id: string; date: Date } }
  | { type: "DELETE_TASK"; payload: string }
  | { type: "EDIT_TASK"; payload: Task }
  | { type: "REPLACE_ALL"; payload: TasksState }
  | { type: "REORDER_TASKS"; payload: Task[] }
  | { type: "ADD_TAG"; payload: TaskTag }
  | { type: "EDIT_TAG"; payload: TaskTag }
  | { type: "DELETE_TAG"; payload: string }

// Task state definition
type TasksState = {
  tasks: Task[]
  tags: TaskTag[]
}

// Create context for tasks
const TasksContext = createContext<{
  state: TasksState
  dispatch: React.Dispatch<TaskAction>
} | null>(null)

// Tasks reducer
function tasksReducer(state: TasksState, action: TaskAction): TasksState {
  switch (action.type) {
    case "ADD_TASK":
      return {
        ...state,
        tasks: [...state.tasks, action.payload],
      }
    case "TOGGLE_TASK":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.payload.id
            ? {
                ...task,
                completed: !task.completed,
                completedAt: !task.completed ? action.payload.date : null,
              }
            : task,
        ),
      }
    case "DELETE_TASK":
      return {
        ...state,
        tasks: state.tasks.filter((task) => task.id !== action.payload),
      }
    case "EDIT_TASK":
      return {
        ...state,
        tasks: state.tasks.map((task) => (task.id === action.payload.id ? action.payload : task)),
      }
    case "REPLACE_ALL":
      return action.payload
    case "REORDER_TASKS":
      return {
        ...state,
        tasks: action.payload,
      }
    case "ADD_TAG":
      return {
        ...state,
        tags: [...state.tags, action.payload],
      }
    case "EDIT_TAG":
      return {
        ...state,
        tags: state.tags.map((tag) => (tag.id === action.payload.id ? action.payload : tag)),
      }
    case "DELETE_TAG":
      return {
        ...state,
        tags: state.tags.filter((tag) => tag.id !== action.payload),
        tasks: state.tasks.map((task) => ({
          ...task,
          tags: task.tags.filter((tagId) => tagId !== action.payload),
        })),
      }
    default:
      return state
  }
}

// Custom hook to use tasks context
function useTasksContext() {
  const context = useContext(TasksContext)
  if (!context) {
    throw new Error("useTasksContext must be used within a TasksProvider")
  }
  return context
}

// Tag component
function TagBadge({ tagId }: { tagId: string }) {
  const { state } = useTasksContext()
  const tag = state.tags.find((t) => t.id === tagId)

  if (!tag) return null

  return (
    <Badge style={{ backgroundColor: tag.color, color: getContrastColor(tag.color) }} className="mr-1">
      {tag.name}
    </Badge>
  )
}

// Helper function to determine text color based on background color
function getContrastColor(hexColor: string): string {
  // Remove the # if it exists
  const color = hexColor.replace("#", "")

  // Convert to RGB
  const r = Number.parseInt(color.substr(0, 2), 16)
  const g = Number.parseInt(color.substr(2, 2), 16)
  const b = Number.parseInt(color.substr(4, 2), 16)

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  // Return black or white based on luminance
  return luminance > 0.5 ? "#000000" : "#ffffff"
}

// Task item component
function TaskItem({ task, index }: { task: Task; index: number }) {
  const { state, dispatch } = useTasksContext()
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editedTask, setEditedTask] = useState<Task>(task)

  // Get priority color
  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1:
        return "bg-green-100 text-green-800"
      case 2:
        return "bg-blue-100 text-blue-800"
      case 3:
        return "bg-yellow-100 text-yellow-800"
      case 4:
        return "bg-orange-100 text-orange-800"
      case 5:
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Get priority text
  const getPriorityText = (priority: number) => {
    switch (priority) {
      case 1:
        return "Very Low"
      case 2:
        return "Low"
      case 3:
        return "Medium"
      case 4:
        return "High"
      case 5:
        return "Very High"
      default:
        return "Unspecified"
    }
  }

  // Calculate days remaining until due date
  const getDaysRemaining = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(task.dueDate)
    dueDate.setHours(0, 0, 0, 0)

    const diffTime = dueDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? "s" : ""}`
    } else if (diffDays === 0) {
      return "Due today"
    } else {
      return `${diffDays} day${diffDays !== 1 ? "s" : ""} left`
    }
  }

  // Get status color
  const getStatusColor = () => {
    if (task.completed) return "bg-green-100 text-green-800"

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(task.dueDate)
    dueDate.setHours(0, 0, 0, 0)

    if (dueDate < today) return "bg-red-100 text-red-800"
    if (dueDate.getTime() === today.getTime()) return "bg-orange-100 text-orange-800"
    return "bg-blue-100 text-blue-800"
  }

  // Update edited task
  const handleSaveEdit = () => {
    dispatch({ type: "EDIT_TASK", payload: editedTask })
    setIsEditDialogOpen(false)
  }

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided) => (
        <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
          <Card className={`mb-4 ${task.completed ? "opacity-80" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="pt-1">
                    <Checkbox
                      checked={task.completed}
                      onCheckedChange={() =>
                        dispatch({
                          type: "TOGGLE_TASK",
                          payload: { id: task.id, date: new Date() },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <h3 className={`font-medium ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                      {task.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3" />
                              {format(new Date(task.dueDate), "MMM dd, yyyy")}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Due date</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <Badge variant="outline" className={getStatusColor()}>
                        {getDaysRemaining()}
                      </Badge>

                      <Badge className={getPriorityColor(task.priority)}>{getPriorityText(task.priority)}</Badge>

                      {task.tags.map((tagId) => (
                        <TagBadge key={tagId} tagId={tagId} />
                      ))}
                    </div>

                    {task.completedAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Completed on {format(new Date(task.completedAt), "MMM dd, yyyy")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)}>
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => dispatch({ type: "DELETE_TASK", payload: task.id })}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit Task Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Edit Task</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Task Name</Label>
                  <Input
                    id="edit-name"
                    value={editedTask.name}
                    onChange={(e) => setEditedTask({ ...editedTask, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editedTask.description}
                    onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Due Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editedTask.dueDate ? format(new Date(editedTask.dueDate), "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={new Date(editedTask.dueDate)}
                        onSelect={(date) => date && setEditedTask({ ...editedTask, dueDate: date })}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-priority">Priority</Label>
                  <Select
                    value={editedTask.priority.toString()}
                    onValueChange={(value) => setEditedTask({ ...editedTask, priority: Number.parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Very Low</SelectItem>
                      <SelectItem value="2">Low</SelectItem>
                      <SelectItem value="3">Medium</SelectItem>
                      <SelectItem value="4">High</SelectItem>
                      <SelectItem value="5">Very High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {state.tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        style={{
                          backgroundColor: editedTask.tags.includes(tag.id) ? tag.color : "transparent",
                          color: editedTask.tags.includes(tag.id) ? getContrastColor(tag.color) : "inherit",
                          borderColor: tag.color,
                          borderWidth: "1px",
                        }}
                        className="cursor-pointer"
                        onClick={() => {
                          if (editedTask.tags.includes(tag.id)) {
                            setEditedTask({
                              ...editedTask,
                              tags: editedTask.tags.filter((id) => id !== tag.id),
                            })
                          } else {
                            setEditedTask({
                              ...editedTask,
                              tags: [...editedTask.tags, tag.id],
                            })
                          }
                        }}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSaveEdit}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </Draggable>
  )
}

// Add task form component
function AddTaskForm() {
  const { state, dispatch } = useTasksContext()
  const [isOpen, setIsOpen] = useState(false)
  const [newTask, setNewTask] = useState<Omit<Task, "id" | "createdAt" | "completedAt" | "position">>({
    name: "",
    description: "",
    dueDate: new Date(),
    completed: false,
    priority: 3,
    tags: [],
  })

  const handleAddTask = () => {
    if (newTask.name.trim() === "") return

    const task: Task = {
      ...newTask,
      id: Date.now().toString(),
      createdAt: new Date(),
      completedAt: null,
      position: state.tasks.length,
    }

    dispatch({ type: "ADD_TASK", payload: task })
    setNewTask({
      name: "",
      description: "",
      dueDate: new Date(),
      completed: false,
      priority: 3,
      tags: [],
    })
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="mb-6">
          <Plus className="mr-2 h-4 w-4" />
          Add New Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Task Name</Label>
            <Input
              id="name"
              value={newTask.name}
              onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
              placeholder="Enter task name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              placeholder="Enter task description"
            />
          </div>
          <div className="grid gap-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {newTask.dueDate ? format(newTask.dueDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={newTask.dueDate}
                  onSelect={(date) => date && setNewTask({ ...newTask, dueDate: date })}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={newTask.priority.toString()}
              onValueChange={(value) => setNewTask({ ...newTask, priority: Number.parseInt(value) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Very Low</SelectItem>
                <SelectItem value="2">Low</SelectItem>
                <SelectItem value="3">Medium</SelectItem>
                <SelectItem value="4">High</SelectItem>
                <SelectItem value="5">Very High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {state.tags.map((tag) => (
                <Badge
                  key={tag.id}
                  style={{
                    backgroundColor: newTask.tags.includes(tag.id) ? tag.color : "transparent",
                    color: newTask.tags.includes(tag.id) ? getContrastColor(tag.color) : "inherit",
                    borderColor: tag.color,
                    borderWidth: "1px",
                  }}
                  className="cursor-pointer"
                  onClick={() => {
                    if (newTask.tags.includes(tag.id)) {
                      setNewTask({
                        ...newTask,
                        tags: newTask.tags.filter((id) => id !== tag.id),
                      })
                    } else {
                      setNewTask({
                        ...newTask,
                        tags: [...newTask.tags, tag.id],
                      })
                    }
                  }}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleAddTask}>Add Task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Tag management component
function TagManager() {
  const { state, dispatch } = useTasksContext()
  const [isOpen, setIsOpen] = useState(false)
  const [newTag, setNewTag] = useState<Omit<TaskTag, "id">>({
    name: "",
    color: "#3b82f6", // Default blue color
  })
  const [editingTag, setEditingTag] = useState<TaskTag | null>(null)

  const handleAddTag = () => {
    if (newTag.name.trim() === "") return

    const tag: TaskTag = {
      ...newTag,
      id: Date.now().toString(),
    }

    dispatch({ type: "ADD_TAG", payload: tag })
    setNewTag({
      name: "",
      color: "#3b82f6",
    })
  }

  const handleUpdateTag = () => {
    if (!editingTag || editingTag.name.trim() === "") return

    dispatch({ type: "EDIT_TAG", payload: editingTag })
    setEditingTag(null)
  }

  const handleDeleteTag = (id: string) => {
    dispatch({ type: "DELETE_TAG", payload: id })
    if (editingTag && editingTag.id === id) {
      setEditingTag(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <TagIcon className="mr-2 h-4 w-4" />
          Manage Tags
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex gap-2">
            <Input
              value={newTag.name}
              onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
              placeholder="New tag name"
            />
            <Input
              type="color"
              value={newTag.color}
              onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
              className="w-16"
            />
            <Button onClick={handleAddTag}>Add</Button>
          </div>

          <div className="border rounded-md p-4">
            <h3 className="font-medium mb-2">Your Tags</h3>
            {state.tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags created yet</p>
            ) : (
              <div className="space-y-2">
                {state.tags.map((tag) => (
                  <div key={tag.id} className="flex items-center justify-between">
                    {editingTag && editingTag.id === tag.id ? (
                      <>
                        <div className="flex gap-2 flex-1">
                          <Input
                            value={editingTag.name}
                            onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                          />
                          <Input
                            type="color"
                            value={editingTag.color}
                            onChange={(e) => setEditingTag({ ...editingTag, color: e.target.value })}
                            className="w-16"
                          />
                        </div>
                        <div className="flex gap-2 ml-2">
                          <Button size="sm" onClick={handleUpdateTag}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingTag(null)}>
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center">
                          <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: tag.color }}></div>
                          <span>{tag.name}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditingTag(tag)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteTag(tag.id)}>
                            Delete
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Analytics component
function TaskAnalytics({ tasks }: { tasks: Task[] }) {
  // Calculate statistics
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((task) => task.completed).length
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  const overdueTasks = tasks.filter((task) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(task.dueDate)
    dueDate.setHours(0, 0, 0, 0)
    return !task.completed && dueDate < today
  }).length

  const dueTodayTasks = tasks.filter((task) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(task.dueDate)
    dueDate.setHours(0, 0, 0, 0)
    return !task.completed && dueDate.getTime() === today.getTime()
  }).length

  const upcomingTasks = tasks.filter((task) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(task.dueDate)
    dueDate.setHours(0, 0, 0, 0)
    return !task.completed && dueDate > today
  }).length

  // Priority distribution
  const priorityDistribution = [0, 0, 0, 0, 0] // Index 0-4 for priority 1-5
  tasks.forEach((task) => {
    if (task.priority >= 1 && task.priority <= 5) {
      priorityDistribution[task.priority - 1]++
    }
  })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-sm font-medium text-muted-foreground">Total Tasks</h3>
              <p className="text-3xl font-bold">{totalTasks}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-sm font-medium text-muted-foreground">Completion Rate</h3>
              <p className="text-3xl font-bold">{completionRate.toFixed(0)}%</p>
              <Progress value={completionRate} className="mt-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-sm font-medium text-muted-foreground">Overdue</h3>
              <p className="text-3xl font-bold text-red-500">{overdueTasks}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-sm font-medium text-muted-foreground">Due Today</h3>
              <p className="text-3xl font-bold text-orange-500">{dueTodayTasks}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-medium mb-4">Priority Distribution</h3>
          <div className="space-y-2">
            {["Very Low", "Low", "Medium", "High", "Very High"].map((label, index) => (
              <div key={index} className="flex items-center">
                <span className="w-24 text-sm">{label}</span>
                <div className="flex-1 mx-2">
                  <Progress
                    value={totalTasks > 0 ? (priorityDistribution[index] / totalTasks) * 100 : 0}
                    className={`h-4 ${
                      index === 0
                        ? "bg-green-100"
                        : index === 1
                          ? "bg-blue-100"
                          : index === 2
                            ? "bg-yellow-100"
                            : index === 3
                              ? "bg-orange-100"
                              : "bg-red-100"
                    }`}
                  />
                </div>
                <span className="w-8 text-right text-sm">{priorityDistribution[index]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Search component
function TaskSearch({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState("")

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setQuery(newQuery)
    onSearch(newQuery)
  }

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input type="search" placeholder="Search tasks..." className="pl-8" value={query} onChange={handleSearch} />
    </div>
  )
}

// Main component
export default function AdvancedTaskManager() {
  // Use reducer for state management
  const [state, dispatch] = useReducer(tasksReducer, {
    tasks: [
      {
        id: "1",
        name: "Complete React Project",
        description: "Finish developing the advanced task manager component",
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        completed: false,
        priority: 4,
        tags: ["1"],
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        completedAt: null,
        position: 0,
      },
      {
        id: "2",
        name: "Read React Hooks Book",
        description: "Read chapters 3-5 of the book",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        completed: false,
        priority: 2,
        tags: ["2"],
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        completedAt: null,
        position: 1,
      },
      {
        id: "3",
        name: "Update Resume",
        description: "Add new skills and projects",
        dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago (overdue)
        completed: true,
        priority: 3,
        tags: ["3"],
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        position: 2,
      },
      {
        id: "4",
        name: "Prepare for Interview",
        description: "Research company and practice common questions",
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
        completed: false,
        priority: 5,
        tags: ["1", "3"],
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        completedAt: null,
        position: 3,
      },
    ],
    tags: [
      {
        id: "1",
        name: "Work",
        color: "#3b82f6", // blue
      },
      {
        id: "2",
        name: "Learning",
        color: "#10b981", // green
      },
      {
        id: "3",
        name: "Personal",
        color: "#8b5cf6", // purple
      },
    ],
  })

  // Filter and sort state
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "active">("all")
  const [priorityFilter, setPriorityFilter] = useState<number | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<"dueDate" | "priority" | "name" | "createdAt">("dueDate")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("tasks")

  // Apply filters and sorting to tasks
  const filteredAndSortedTasks = useMemo(() => {
    let filtered = [...state.tasks]

    // Apply search filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (task) => task.name.toLowerCase().includes(query) || task.description.toLowerCase().includes(query),
      )
    }

    // Apply status filter
    if (statusFilter === "completed") {
      filtered = filtered.filter((task) => task.completed)
    } else if (statusFilter === "active") {
      filtered = filtered.filter((task) => !task.completed)
    }

    // Apply priority filter
    if (priorityFilter !== null) {
      filtered = filtered.filter((task) => task.priority === priorityFilter)
    }

    // Apply tag filter
    if (tagFilter !== null) {
      filtered = filtered.filter((task) => task.tags.includes(tagFilter))
    }

    // Apply sorting
    if (sortBy === "dueDate") {
      filtered.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    } else if (sortBy === "priority") {
      filtered.sort((a, b) => b.priority - a.priority)
    } else if (sortBy === "name") {
      filtered.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === "createdAt") {
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }

    return filtered
  }, [state.tasks, statusFilter, priorityFilter, tagFilter, sortBy, searchQuery])

  // Save tasks to local storage
  useEffect(() => {
    const savedTasks = localStorage.getItem("advancedTasks")
    if (savedTasks) {
      try {
        const parsedData = JSON.parse(savedTasks)
        // Convert date strings to Date objects
        const tasksWithDates = {
          tasks: parsedData.tasks.map((task: any) => ({
            ...task,
            dueDate: new Date(task.dueDate),
            createdAt: new Date(task.createdAt),
            completedAt: task.completedAt ? new Date(task.completedAt) : null,
          })),
          tags: parsedData.tags,
        }
        dispatch({ type: "REPLACE_ALL", payload: tasksWithDates })
      } catch (error) {
        console.error("Error parsing saved tasks:", error)
      }
    }
  }, [])

  // Save tasks when they change
  useEffect(() => {
    localStorage.setItem("advancedTasks", JSON.stringify(state))
  }, [state])

  // Handle drag and drop reordering
  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    const items = Array.from(filteredAndSortedTasks)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    // Update positions
    const updatedItems = items.map((item, index) => ({
      ...item,
      position: index,
    }))

    dispatch({ type: "REORDER_TASKS", payload: updatedItems })
  }

  return (
    <TasksContext.Provider value={{ state, dispatch }}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4 items-start">
          <TabsList>
            <TabsTrigger value="tasks" className="flex items-center">
              <Clock className="mr-2 h-4 w-4" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center">
              <BarChart2 className="mr-2 h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <AddTaskForm />
            <TagManager />
          </div>
        </div>

        <TabsContent value="tasks" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <TaskSearch onSearch={setSearchQuery} />
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <div className="flex items-center">
                <Filter className="mr-2 h-4 w-4" />
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as "all" | "completed" | "active")}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tasks</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center">
                <Filter className="mr-2 h-4 w-4" />
                <Select
                  value={priorityFilter?.toString() || "0"}
                  onValueChange={(value) => setPriorityFilter(value ? Number.parseInt(value) : null)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Filter by priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">All Priorities</SelectItem>
                    <SelectItem value="1">Very Low</SelectItem>
                    <SelectItem value="2">Low</SelectItem>
                    <SelectItem value="3">Medium</SelectItem>
                    <SelectItem value="4">High</SelectItem>
                    <SelectItem value="5">Very High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center">
                <TagIcon className="mr-2 h-4 w-4" />
                <Select value={tagFilter || "0"} onValueChange={(value) => setTagFilter(value === "0" ? null : value)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Filter by tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">All Tags</SelectItem>
                    {state.tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center">
                <SortAsc className="mr-2 h-4 w-4" />
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dueDate">Due Date</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="createdAt">Created Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Tasks ({filteredAndSortedTasks.length})</h2>
            {filteredAndSortedTasks.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No tasks match the selected criteria</p>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="tasks">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef}>
                      {filteredAndSortedTasks.map((task, index) => (
                        <TaskItem key={task.id} task={task} index={index} />
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <TaskAnalytics tasks={state.tasks} />
        </TabsContent>
      </Tabs>
    </TasksContext.Provider>
  )
}
