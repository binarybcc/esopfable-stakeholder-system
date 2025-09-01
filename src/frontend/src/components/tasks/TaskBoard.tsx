import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import { cn, formatDate, getPriorityColor, getStatusColor } from '@/utils';
import { Task, FilterOptions, SortOption } from '@/types';
import { taskApi, searchApi } from '@/services/api';
import { useSocket } from '@/hooks/useSocket';
import { useDebounce } from '@/hooks/useDebounce';
import { TaskForm } from './TaskForm';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';

interface TaskBoardProps {
  className?: string;
}

const TaskBoard: React.FC<TaskBoardProps> = ({ className }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterOptions>({});
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const socket = useSocket();

  const taskColumns = {
    pending: { title: 'Pending', color: 'bg-yellow-50 border-yellow-200' },
    in_progress: { title: 'In Progress', color: 'bg-blue-50 border-blue-200' },
    completed: { title: 'Completed', color: 'bg-green-50 border-green-200' },
    blocked: { title: 'Blocked', color: 'bg-red-50 border-red-200' },
    cancelled: { title: 'Cancelled', color: 'bg-gray-50 border-gray-200' },
  };

  useEffect(() => {
    loadTasks();
  }, [debouncedSearchQuery, filters]);

  useEffect(() => {
    if (socket) {
      socket.on('task_created', handleTaskCreated);
      socket.on('task_updated', handleTaskUpdated);
      socket.on('task_deleted', handleTaskDeleted);

      return () => {
        socket.off('task_created');
        socket.off('task_updated');
        socket.off('task_deleted');
      };
    }
  }, [socket]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const params = {
        q: debouncedSearchQuery,
        ...filters,
        sort: 'priority:desc,createdAt:desc',
        limit: 100,
      };

      const response = debouncedSearchQuery 
        ? await searchApi.global(debouncedSearchQuery, { ...params, type: 'tasks' })
        : await taskApi.list(params);

      if (response.success) {
        setTasks(response.data.items || []);
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskCreated = (task: Task) => {
    setTasks(prev => [task, ...prev]);
  };

  const handleTaskUpdated = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => 
      t.id === updatedTask.id ? updatedTask : t
    ));
  };

  const handleTaskDeleted = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleCreateTask = () => {
    setSelectedTask(null);
    setIsFormOpen(true);
  };

  const handleViewTask = (task: Task) => {
    setSelectedTask(task);
    setIsViewModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: Partial<Task>) => {
    try {
      const response = selectedTask
        ? await taskApi.update(selectedTask.id, data)
        : await taskApi.create(data);

      if (response.success) {
        if (selectedTask) {
          handleTaskUpdated(response.data);
        } else {
          handleTaskCreated(response.data);
        }
        setIsFormOpen(false);
        setSelectedTask(null);
      }
    } catch (error) {
      console.error('Failed to save task:', error);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const task = tasks.find(t => t.id === draggableId);
    if (!task) return;

    const newStatus = destination.droppableId as Task['status'];
    
    try {
      await taskApi.updateStatus(task.id, newStatus);
      
      // Optimistically update the UI
      const updatedTask = { ...task, status: newStatus };
      if (newStatus === 'completed' && !task.completedAt) {
        updatedTask.completedAt = new Date().toISOString();
      }
      handleTaskUpdated(updatedTask);
    } catch (error) {
      console.error('Failed to update task status:', error);
      // Revert the change on error
      loadTasks();
    }
  };

  const getTasksByStatus = (status: string) => {
    return tasks.filter(task => task.status === status);
  };

  const priorityOptions = [
    { value: '', label: 'All Priorities' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ];

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const renderKanbanBoard = () => (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex space-x-6 overflow-x-auto pb-4">
        {Object.entries(taskColumns).map(([status, config]) => {
          const statusTasks = getTasksByStatus(status);
          
          return (
            <div key={status} className="flex-shrink-0 w-80">
              <div className={cn('rounded-lg border-2 border-dashed p-4 min-h-[600px]', config.color)}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {config.title}
                  </h3>
                  <Badge variant="outline">
                    {statusTasks.length}
                  </Badge>
                </div>
                
                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        'space-y-3 min-h-[500px]',
                        snapshot.isDraggingOver && 'bg-white/50 rounded-md'
                      )}
                    >
                      {statusTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={cn(
                                'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 shadow-sm cursor-pointer',
                                snapshot.isDragging && 'rotate-2 shadow-lg'
                              )}
                              onClick={() => handleViewTask(task)}
                            >
                              <TaskCard task={task} compact />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );

  const renderListView = () => (
    <div className="space-y-3">
      {tasks.map(task => (
        <Card key={task.id} className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <TaskCard task={task} onClick={() => handleViewTask(task)} />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Task Board
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage and track task progress
          </p>
        </div>
        <Button onClick={handleCreateTask}>
          Create Task
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex-1 max-w-md">
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Select
                value={filters.priority?.[0] || ''}
                onChange={(value) => setFilters(prev => ({
                  ...prev,
                  priority: value ? [value] : undefined
                }))}
                options={priorityOptions}
                className="min-w-[120px]"
              />
              <Select
                value={filters.status?.[0] || ''}
                onChange={(value) => setFilters(prev => ({
                  ...prev,
                  status: value ? [value] : undefined
                }))}
                options={statusOptions}
                className="min-w-[120px]"
              />
              <div className="flex items-center border border-gray-300 rounded-md">
                <Button
                  variant={viewMode === 'kanban' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('kanban')}
                  className="rounded-r-none"
                >
                  Kanban
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  List
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No tasks found</p>
            </div>
          ) : (
            viewMode === 'kanban' ? renderKanbanBoard() : renderListView()
          )}
        </CardContent>
      </Card>

      {/* Task Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedTask(null);
        }}
        title={selectedTask ? 'Edit Task' : 'Create Task'}
        size="lg"
      >
        <TaskForm
          task={selectedTask}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setIsFormOpen(false);
            setSelectedTask(null);
          }}
        />
      </Modal>

      {/* Task View Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Task Details"
        size="lg"
      >
        {selectedTask && (
          <TaskDetails 
            task={selectedTask}
            onEdit={() => {
              setIsViewModalOpen(false);
              setIsFormOpen(true);
            }}
          />
        )}
      </Modal>
    </div>
  );
};

// Task Card Component
interface TaskCardProps {
  task: Task;
  compact?: boolean;
  onClick?: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, compact = false, onClick }) => {
  return (
    <div onClick={onClick} className={cn(compact && 'space-y-2')}>
      <div className="flex items-start justify-between">
        <h3 className={cn(
          'font-medium text-gray-900 dark:text-gray-100',
          compact ? 'text-sm line-clamp-2' : 'text-base'
        )}>
          {task.title}
        </h3>
        {!compact && (
          <Badge className={getPriorityColor(task.priority)}>
            {task.priority}
          </Badge>
        )}
      </div>
      
      {task.description && (
        <p className={cn(
          'text-gray-600 dark:text-gray-400',
          compact ? 'text-xs line-clamp-2' : 'text-sm'
        )}>
          {compact ? task.description.substring(0, 100) + (task.description.length > 100 ? '...' : '') : task.description}
        </p>
      )}
      
      <div className={cn('flex items-center justify-between', compact ? 'text-xs' : 'text-sm')}>
        <div className="flex items-center space-x-2">
          {compact && (
            <Badge className={getPriorityColor(task.priority)} size="sm">
              {task.priority}
            </Badge>
          )}
          {!compact && (
            <Badge className={getStatusColor(task.status)}>
              {task.status.replace('_', ' ')}
            </Badge>
          )}
        </div>
        <div className="text-gray-500">
          {task.dueDate ? formatDate(task.dueDate) : 'No due date'}
        </div>
      </div>
      
      {task.stakeholderIds.length > 0 && (
        <div className="flex items-center space-x-1">
          <span className={cn('text-gray-500', compact ? 'text-xs' : 'text-sm')}>Stakeholders:</span>
          <Badge variant="outline" size={compact ? 'sm' : undefined}>
            {task.stakeholderIds.length}
          </Badge>
        </div>
      )}
    </div>
  );
};

// Task Details Component
interface TaskDetailsProps {
  task: Task;
  onEdit: () => void;
}

const TaskDetails: React.FC<TaskDetailsProps> = ({ task, onEdit }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <Badge className={getStatusColor(task.status)}>
            {task.status.replace('_', ' ')}
          </Badge>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Priority
          </label>
          <Badge className={getPriorityColor(task.priority)}>
            {task.priority}
          </Badge>
        </div>
        
        {task.dueDate && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Due Date
            </label>
            <p className="text-sm text-gray-900 dark:text-gray-100">
              {formatDate(task.dueDate)}
            </p>
          </div>
        )}
        
        {task.completedAt && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Completed
            </label>
            <p className="text-sm text-gray-900 dark:text-gray-100">
              {formatDate(task.completedAt)}
            </p>
          </div>
        )}
      </div>
      
      {task.description && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
            {task.description}
          </div>
        </div>
      )}
      
      {task.stakeholderIds.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Stakeholders
          </label>
          <p className="text-sm text-gray-900 dark:text-gray-100">
            {task.stakeholderIds.length} stakeholder(s) assigned
          </p>
        </div>
      )}
      
      {task.dependsOn.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Dependencies
          </label>
          <p className="text-sm text-gray-900 dark:text-gray-100">
            Depends on {task.dependsOn.length} task(s)
          </p>
        </div>
      )}
      
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline" onClick={onEdit}>
          Edit Task
        </Button>
      </div>
    </div>
  );
};

export default TaskBoard;