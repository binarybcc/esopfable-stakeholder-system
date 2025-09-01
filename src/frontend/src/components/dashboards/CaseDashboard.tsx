import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { cn, formatDate, formatRelativeTime } from '@/utils';
import { DashboardStats, Task, Communication, RiskEvent } from '@/types';
import { analyticsApi, taskApi, communicationApi, riskApi } from '@/services/api';
import { useSocket } from '@/hooks/useSocket';

interface CaseDashboardProps {
  className?: string;
}

const CaseDashboard: React.FC<CaseDashboardProps> = ({ className }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [recentCommunications, setRecentCommunications] = useState<Communication[]>([]);
  const [activeRiskEvents, setActiveRiskEvents] = useState<RiskEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const socket = useSocket();

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('dashboard_update', loadDashboardData);
      socket.on('task_updated', refreshTasks);
      socket.on('communication_added', refreshCommunications);
      socket.on('risk_event_updated', refreshRiskEvents);

      return () => {
        socket.off('dashboard_update');
        socket.off('task_updated');
        socket.off('communication_added');
        socket.off('risk_event_updated');
      };
    }
  }, [socket]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsResponse, tasksResponse, commsResponse, risksResponse] = await Promise.all([
        analyticsApi.dashboard(),
        taskApi.list({ limit: 5, status: 'in_progress,pending' }),
        communicationApi.list({ limit: 5, sort: 'createdAt:desc' }),
        riskApi.events({ limit: 5, status: 'open,investigating' })
      ]);

      if (statsResponse.success) setStats(statsResponse.data);
      if (tasksResponse.success) setRecentTasks(tasksResponse.data.items || []);
      if (commsResponse.success) setRecentCommunications(commsResponse.data.items || []);
      if (risksResponse.success) setActiveRiskEvents(risksResponse.data.items || []);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshTasks = () => {
    taskApi.list({ limit: 5, status: 'in_progress,pending' })
      .then(response => {
        if (response.success) setRecentTasks(response.data.items || []);
      });
  };

  const refreshCommunications = () => {
    communicationApi.list({ limit: 5, sort: 'createdAt:desc' })
      .then(response => {
        if (response.success) setRecentCommunications(response.data.items || []);
      });
  };

  const refreshRiskEvents = () => {
    riskApi.events({ limit: 5, status: 'open,investigating' })
      .then(response => {
        if (response.success) setActiveRiskEvents(response.data.items || []);
      });
  };

  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Stakeholders"
          value={stats?.totalStakeholders || 0}
          icon="👥"
          color="bg-blue-50 text-blue-600"
        />
        <StatsCard
          title="Active Documents"
          value={stats?.activeDocuments || 0}
          icon="📄"
          color="bg-green-50 text-green-600"
        />
        <StatsCard
          title="Pending Tasks"
          value={stats?.pendingTasks || 0}
          icon="✅"
          color="bg-yellow-50 text-yellow-600"
        />
        <StatsCard
          title="Risk Events"
          value={stats?.openRiskEvents || 0}
          icon="⚠️"
          color="bg-red-50 text-red-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tasks */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTasks.length > 0 ? (
                recentTasks.map(task => (
                  <TaskItem key={task.id} task={task} />
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No active tasks</p>
              )}
            </div>
            <div className="mt-4 pt-4 border-t">
              <Button variant="outline" size="sm" className="w-full">
                View All Tasks
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Communications */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Communications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentCommunications.length > 0 ? (
                recentCommunications.map(comm => (
                  <CommunicationItem key={comm.id} communication={comm} />
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No recent communications</p>
              )}
            </div>
            <div className="mt-4 pt-4 border-t">
              <Button variant="outline" size="sm" className="w-full">
                View All Communications
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Active Risk Events */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Active Risk Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeRiskEvents.length > 0 ? (
                activeRiskEvents.map(risk => (
                  <RiskEventItem key={risk.id} riskEvent={risk} />
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No active risk events</p>
              )}
            </div>
            <div className="mt-4 pt-4 border-t">
              <Button variant="outline" size="sm" className="w-full">
                View Risk Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Sub-components
interface StatsCardProps {
  title: string;
  value: number;
  icon: string;
  color: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color }) => {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
          </div>
          <div className={cn('p-3 rounded-full text-2xl', color)}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface TaskItemProps {
  task: Task;
}

const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  return (
    <div className="flex items-start justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex-1">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {task.title}
        </h4>
        <p className="text-xs text-gray-500 mt-1">
          Due: {task.dueDate ? formatDate(task.dueDate) : 'No due date'}
        </p>
      </div>
      <div className="ml-4 flex items-center space-x-2">
        <Badge variant={task.priority === 'high' || task.priority === 'critical' ? 'danger' : 'secondary'}>
          {task.priority}
        </Badge>
        <Badge variant={task.status === 'in_progress' ? 'primary' : 'secondary'}>
          {task.status.replace('_', ' ')}
        </Badge>
      </div>
    </div>
  );
};

interface CommunicationItemProps {
  communication: Communication;
}

const CommunicationItem: React.FC<CommunicationItemProps> = ({ communication }) => {
  return (
    <div className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex-1">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {communication.subject || `${communication.communicationType} communication`}
        </h4>
        <p className="text-xs text-gray-500 mt-1">
          {formatRelativeTime(communication.occurredAt)} • {communication.participants.length} participants
        </p>
      </div>
      <Badge variant="outline">{communication.communicationType}</Badge>
    </div>
  );
};

interface RiskEventItemProps {
  riskEvent: RiskEvent;
}

const RiskEventItem: React.FC<RiskEventItemProps> = ({ riskEvent }) => {
  const getSeverityColor = (level: number) => {
    if (level >= 8) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    if (level >= 6) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    if (level >= 4) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  };

  return (
    <div className="flex items-start justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex-1">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {riskEvent.eventType}
        </h4>
        <p className="text-xs text-gray-500 mt-1">
          {riskEvent.description.substring(0, 100)}...
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Reported {formatRelativeTime(riskEvent.reportedAt)}
        </p>
      </div>
      <div className="ml-4 flex items-center space-x-2">
        <div className={cn('px-2 py-1 rounded-full text-xs font-medium', getSeverityColor(riskEvent.severityLevel))}>
          Level {riskEvent.severityLevel}
        </div>
        <Badge variant={riskEvent.status === 'investigating' ? 'primary' : 'secondary'}>
          {riskEvent.status}
        </Badge>
      </div>
    </div>
  );
};

export default CaseDashboard;