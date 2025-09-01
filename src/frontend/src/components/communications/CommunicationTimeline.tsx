import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import { cn, formatDate, formatDateTime, formatRelativeTime } from '@/utils';
import { Communication, FilterOptions, SortOption } from '@/types';
import { communicationApi, searchApi } from '@/services/api';
import { useSocket } from '@/hooks/useSocket';
import { useDebounce } from '@/hooks/useDebounce';
import { CommunicationForm } from './CommunicationForm';

interface CommunicationTimelineProps {
  className?: string;
  stakeholderId?: string;
}

const CommunicationTimeline: React.FC<CommunicationTimelineProps> = ({ 
  className, 
  stakeholderId 
}) => {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterOptions>({});
  const [selectedCommunication, setSelectedCommunication] = useState<Communication | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const socket = useSocket();

  useEffect(() => {
    loadCommunications();
  }, [debouncedSearchQuery, filters, stakeholderId]);

  useEffect(() => {
    if (socket) {
      socket.on('communication_added', handleCommunicationAdded);
      socket.on('communication_updated', handleCommunicationUpdated);
      socket.on('communication_deleted', handleCommunicationDeleted);

      return () => {
        socket.off('communication_added');
        socket.off('communication_updated');
        socket.off('communication_deleted');
      };
    }
  }, [socket]);

  const loadCommunications = async () => {
    try {
      setLoading(true);
      const params = {
        q: debouncedSearchQuery,
        ...filters,
        sort: 'occurredAt:desc',
        stakeholderId,
        limit: 50,
      };

      const response = debouncedSearchQuery 
        ? await searchApi.communications(debouncedSearchQuery, params)
        : await communicationApi.list(params);

      if (response.success) {
        setCommunications(response.data.items || []);
      }
    } catch (error) {
      console.error('Failed to load communications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCommunicationAdded = (communication: Communication) => {
    setCommunications(prev => [communication, ...prev]);
  };

  const handleCommunicationUpdated = (updatedCommunication: Communication) => {
    setCommunications(prev => prev.map(c => 
      c.id === updatedCommunication.id ? updatedCommunication : c
    ));
  };

  const handleCommunicationDeleted = (communicationId: string) => {
    setCommunications(prev => prev.filter(c => c.id !== communicationId));
  };

  const handleCreateCommunication = () => {
    setSelectedCommunication(null);
    setIsFormOpen(true);
  };

  const handleViewCommunication = (communication: Communication) => {
    setSelectedCommunication(communication);
    setIsViewModalOpen(true);
  };

  const handleEditCommunication = (communication: Communication) => {
    setSelectedCommunication(communication);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: Partial<Communication>) => {
    try {
      const response = selectedCommunication
        ? await communicationApi.update(selectedCommunication.id, data)
        : await communicationApi.create(data);

      if (response.success) {
        if (selectedCommunication) {
          handleCommunicationUpdated(response.data);
        } else {
          handleCommunicationAdded(response.data);
        }
        setIsFormOpen(false);
        setSelectedCommunication(null);
      }
    } catch (error) {
      console.error('Failed to save communication:', error);
    }
  };

  const toggleExpanded = (communicationId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(communicationId)) {
        newSet.delete(communicationId);
      } else {
        newSet.add(communicationId);
      }
      return newSet;
    });
  };

  const getCommunicationIcon = (type: string) => {
    const icons = {
      email: '📧',
      call: '📞',
      meeting: '👥',
      letter: '📄',
    };
    return icons[type as keyof typeof icons] || '💬';
  };

  const getCommunicationColor = (type: string) => {
    const colors = {
      email: 'bg-blue-50 border-blue-200',
      call: 'bg-green-50 border-green-200',
      meeting: 'bg-purple-50 border-purple-200',
      letter: 'bg-gray-50 border-gray-200',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-50 border-gray-200';
  };

  const communicationTypeOptions = [
    { value: '', label: 'All Types' },
    { value: 'email', label: 'Email' },
    { value: 'call', label: 'Call' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'letter', label: 'Letter' },
  ];

  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        {Array.from({ length: 5 }).map((_, i) => (
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
            Communication Timeline
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Track all communications and interactions
          </p>
        </div>
        <Button onClick={handleCreateCommunication}>
          Log Communication
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex-1 max-w-md">
              <Input
                placeholder="Search communications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Select
                value={filters.communicationType?.[0] || ''}
                onChange={(value) => setFilters(prev => ({
                  ...prev,
                  communicationType: value ? [value] : undefined
                }))}
                options={communicationTypeOptions}
                className="min-w-[120px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {communications.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No communications found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {communications.map((communication, index) => {
                const isExpanded = expandedItems.has(communication.id);
                
                return (
                  <div key={communication.id} className="relative">
                    {/* Timeline line */}
                    {index < communications.length - 1 && (
                      <div className="absolute left-6 top-16 w-0.5 h-full bg-gray-200 dark:bg-gray-700 -z-10" />
                    )}
                    
                    <div className={cn(
                      'border-l-4 border-gray-200 dark:border-gray-700 pl-4',
                      getCommunicationColor(communication.communicationType)
                    )}>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-12 h-12 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center text-lg">
                          {getCommunicationIcon(communication.communicationType)}
                        </div>
                        
                        <div className="flex-1 min-w-0 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {communication.subject || `${communication.communicationType} communication`}
                                </h3>
                                <Badge variant="outline">
                                  {communication.communicationType}
                                </Badge>
                                {communication.sensitiveContent && (
                                  <Badge variant="warning">
                                    Sensitive
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="text-xs text-gray-500 space-y-1">
                                <div>Date: {formatDateTime(communication.occurredAt)}</div>
                                <div>Participants: {communication.participants.length}</div>
                                {communication.durationMinutes && (
                                  <div>Duration: {communication.durationMinutes} minutes</div>
                                )}
                                {communication.location && (
                                  <div>Location: {communication.location}</div>
                                )}
                              </div>
                              
                              {communication.summary && (
                                <div className="mt-2">
                                  <p className="text-sm text-gray-700 dark:text-gray-300">
                                    {isExpanded 
                                      ? communication.summary 
                                      : `${communication.summary.substring(0, 150)}${communication.summary.length > 150 ? '...' : ''}`
                                    }
                                  </p>
                                  {communication.summary.length > 150 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleExpanded(communication.id)}
                                      className="mt-1 p-0 h-auto text-xs"
                                    >
                                      {isExpanded ? 'Show less' : 'Show more'}
                                    </Button>
                                  )}
                                </div>
                              )}
                              
                              {communication.followUpRequired && (
                                <div className="mt-2 flex items-center space-x-2">
                                  <Badge variant="warning">Follow-up Required</Badge>
                                  {communication.followUpDate && (
                                    <span className="text-xs text-gray-500">
                                      Due: {formatDate(communication.followUpDate)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewCommunication(communication)}
                              >
                                View
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditCommunication(communication)}
                              >
                                Edit
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Communication Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedCommunication(null);
        }}
        title={selectedCommunication ? 'Edit Communication' : 'Log Communication'}
        size="lg"
      >
        <CommunicationForm
          communication={selectedCommunication}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setIsFormOpen(false);
            setSelectedCommunication(null);
          }}
          stakeholderId={stakeholderId}
        />
      </Modal>

      {/* Communication View Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Communication Details"
        size="lg"
      >
        {selectedCommunication && (
          <CommunicationDetails 
            communication={selectedCommunication}
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

// Communication Details Component
interface CommunicationDetailsProps {
  communication: Communication;
  onEdit: () => void;
}

const CommunicationDetails: React.FC<CommunicationDetailsProps> = ({ 
  communication, 
  onEdit 
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Type
          </label>
          <Badge variant="outline" className="capitalize">
            {communication.communicationType}
          </Badge>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date & Time
          </label>
          <p className="text-sm text-gray-900 dark:text-gray-100">
            {formatDateTime(communication.occurredAt)}
          </p>
        </div>
        
        {communication.durationMinutes && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Duration
            </label>
            <p className="text-sm text-gray-900 dark:text-gray-100">
              {communication.durationMinutes} minutes
            </p>
          </div>
        )}
        
        {communication.location && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Location
            </label>
            <p className="text-sm text-gray-900 dark:text-gray-100">
              {communication.location}
            </p>
          </div>
        )}
      </div>
      
      {communication.subject && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Subject
          </label>
          <p className="text-sm text-gray-900 dark:text-gray-100">
            {communication.subject}
          </p>
        </div>
      )}
      
      {communication.summary && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Summary
          </label>
          <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
            {communication.summary}
          </div>
        </div>
      )}
      
      {communication.outcome && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Outcome
          </label>
          <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
            {communication.outcome}
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Participants
          </label>
          <p className="text-sm text-gray-900 dark:text-gray-100">
            {communication.participants.length} participant(s)
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Sensitive Content
          </label>
          <Badge variant={communication.sensitiveContent ? 'warning' : 'secondary'}>
            {communication.sensitiveContent ? 'Yes' : 'No'}
          </Badge>
        </div>
      </div>
      
      {communication.followUpRequired && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
          <div className="flex items-center space-x-2 mb-2">
            <Badge variant="warning">Follow-up Required</Badge>
            {communication.followUpDate && (
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Due: {formatDate(communication.followUpDate)}
              </span>
            )}
          </div>
        </div>
      )}
      
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline" onClick={onEdit}>
          Edit Communication
        </Button>
      </div>
    </div>
  );
};

export default CommunicationTimeline;