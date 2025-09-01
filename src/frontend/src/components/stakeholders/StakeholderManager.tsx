import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Table from '../ui/Table';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import { cn, formatDate, getStatusColor, getPriorityColor } from '@/utils';
import { Stakeholder, FilterOptions, SortOption, PaginationState } from '@/types';
import { stakeholderApi, searchApi } from '@/services/api';
import { useSocket } from '@/hooks/useSocket';
import { StakeholderForm } from './StakeholderForm';
import { useDebounce } from '@/hooks/useDebounce';

interface StakeholderManagerProps {
  className?: string;
}

const StakeholderManager: React.FC<StakeholderManagerProps> = ({ className }) => {
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterOptions>({});
  const [sort, setSort] = useState<SortOption>({ field: 'name', direction: 'asc' });
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, pageSize: 20, total: 0 });
  const [selectedStakeholder, setSelectedStakeholder] = useState<Stakeholder | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [stakeholderToDelete, setStakeholderToDelete] = useState<Stakeholder | null>(null);
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const socket = useSocket();

  useEffect(() => {
    loadStakeholders();
  }, [debouncedSearchQuery, filters, sort, pagination.page, pagination.pageSize]);

  useEffect(() => {
    if (socket) {
      socket.on('stakeholder_created', handleStakeholderCreated);
      socket.on('stakeholder_updated', handleStakeholderUpdated);
      socket.on('stakeholder_deleted', handleStakeholderDeleted);

      return () => {
        socket.off('stakeholder_created');
        socket.off('stakeholder_updated');
        socket.off('stakeholder_deleted');
      };
    }
  }, [socket]);

  const loadStakeholders = async () => {
    try {
      setLoading(true);
      const params = {
        q: debouncedSearchQuery,
        ...filters,
        sort: `${sort.field}:${sort.direction}`,
        page: pagination.page,
        pageSize: pagination.pageSize,
      };

      const response = debouncedSearchQuery 
        ? await searchApi.stakeholders(debouncedSearchQuery, params)
        : await stakeholderApi.list(params);

      if (response.success) {
        setStakeholders(response.data.items || []);
        setPagination(prev => ({
          ...prev,
          total: response.data.total || 0
        }));
      }
    } catch (error) {
      console.error('Failed to load stakeholders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStakeholderCreated = (stakeholder: Stakeholder) => {
    setStakeholders(prev => [stakeholder, ...prev]);
    setPagination(prev => ({ ...prev, total: prev.total + 1 }));
  };

  const handleStakeholderUpdated = (updatedStakeholder: Stakeholder) => {
    setStakeholders(prev => prev.map(s => 
      s.id === updatedStakeholder.id ? updatedStakeholder : s
    ));
  };

  const handleStakeholderDeleted = (stakeholderId: string) => {
    setStakeholders(prev => prev.filter(s => s.id !== stakeholderId));
    setPagination(prev => ({ ...prev, total: prev.total - 1 }));
  };

  const handleCreateStakeholder = () => {
    setSelectedStakeholder(null);
    setIsFormOpen(true);
  };

  const handleEditStakeholder = (stakeholder: Stakeholder) => {
    setSelectedStakeholder(stakeholder);
    setIsFormOpen(true);
  };

  const handleDeleteStakeholder = (stakeholder: Stakeholder) => {
    setStakeholderToDelete(stakeholder);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!stakeholderToDelete) return;
    
    try {
      const response = await stakeholderApi.delete(stakeholderToDelete.id);
      if (response.success) {
        handleStakeholderDeleted(stakeholderToDelete.id);
        setIsDeleteModalOpen(false);
        setStakeholderToDelete(null);
      }
    } catch (error) {
      console.error('Failed to delete stakeholder:', error);
    }
  };

  const handleFormSubmit = async (data: Partial<Stakeholder>) => {
    try {
      const response = selectedStakeholder
        ? await stakeholderApi.update(selectedStakeholder.id, data)
        : await stakeholderApi.create(data);

      if (response.success) {
        if (selectedStakeholder) {
          handleStakeholderUpdated(response.data);
        } else {
          handleStakeholderCreated(response.data);
        }
        setIsFormOpen(false);
        setSelectedStakeholder(null);
      }
    } catch (error) {
      console.error('Failed to save stakeholder:', error);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleSortChange = (field: string) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (stakeholder: Stakeholder) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">
            {stakeholder.name}
          </div>
          <div className="text-sm text-gray-500">
            {stakeholder.organization}
          </div>
        </div>
      )
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (stakeholder: Stakeholder) => (
        <div>
          <Badge variant="outline">{stakeholder.category}</Badge>
          {stakeholder.subcategory && (
            <div className="text-xs text-gray-500 mt-1">
              {stakeholder.subcategory}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'title',
      label: 'Title',
      render: (stakeholder: Stakeholder) => stakeholder.title || '-'
    },
    {
      key: 'securityLevel',
      label: 'Security Level',
      sortable: true,
      render: (stakeholder: Stakeholder) => (
        <Badge 
          variant={stakeholder.securityLevel === 'high' ? 'danger' : 
                   stakeholder.securityLevel === 'restricted' ? 'warning' : 'secondary'}
        >
          {stakeholder.securityLevel}
        </Badge>
      )
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (stakeholder: Stakeholder) => formatDate(stakeholder.createdAt)
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (stakeholder: Stakeholder) => (
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditStakeholder(stakeholder)}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteStakeholder(stakeholder)}
            className="text-red-600 hover:text-red-700"
          >
            Delete
          </Button>
        </div>
      )
    }
  ];

  const categoryOptions = [
    { value: '', label: 'All Categories' },
    { value: 'esop_participant', label: 'ESOP Participant' },
    { value: 'government_entity', label: 'Government Entity' },
    { value: 'media_contact', label: 'Media Contact' },
    { value: 'witness', label: 'Witness' },
    { value: 'opposition', label: 'Opposition' },
  ];

  const securityLevelOptions = [
    { value: '', label: 'All Security Levels' },
    { value: 'standard', label: 'Standard' },
    { value: 'restricted', label: 'Restricted' },
    { value: 'high', label: 'High' },
  ];

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Stakeholder Management
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage stakeholders and their information
          </p>
        </div>
        <Button onClick={handleCreateStakeholder}>
          Add Stakeholder
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex-1 max-w-md">
              <Input
                placeholder="Search stakeholders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Select
                value={filters.category?.[0] || ''}
                onChange={(value) => setFilters(prev => ({
                  ...prev,
                  category: value ? [value] : undefined
                }))}
                options={categoryOptions}
                className="min-w-[150px]"
              />
              <Select
                value={filters.securityLevel?.[0] || ''}
                onChange={(value) => setFilters(prev => ({
                  ...prev,
                  securityLevel: value ? [value] : undefined
                }))}
                options={securityLevelOptions}
                className="min-w-[150px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table
            data={stakeholders}
            columns={columns}
            loading={loading}
            pagination={pagination}
            onPageChange={handlePageChange}
            onSort={handleSortChange}
            currentSort={sort}
          />
        </CardContent>
      </Card>

      {/* Stakeholder Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedStakeholder(null);
        }}
        title={selectedStakeholder ? 'Edit Stakeholder' : 'Add Stakeholder'}
        size="lg"
      >
        <StakeholderForm
          stakeholder={selectedStakeholder}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setIsFormOpen(false);
            setSelectedStakeholder(null);
          }}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Stakeholder"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete <strong>{stakeholderToDelete?.name}</strong>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StakeholderManager;