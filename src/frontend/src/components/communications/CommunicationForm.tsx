import React, { useState, useEffect } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { Card, CardContent } from '../ui/Card';
import { cn } from '@/utils';
import { Communication } from '@/types';
import { stakeholderApi } from '@/services/api';

interface CommunicationFormProps {
  communication?: Communication | null;
  onSubmit: (data: Partial<Communication>) => void;
  onCancel: () => void;
  stakeholderId?: string;
  loading?: boolean;
}

interface FormData {
  communicationType: 'email' | 'call' | 'meeting' | 'letter';
  subject: string;
  summary: string;
  outcome: string;
  occurredAt: string;
  durationMinutes: string;
  location: string;
  participants: string[];
  initiatedBy: string;
  followUpRequired: boolean;
  followUpDate: string;
  sensitiveContent: boolean;
}

interface Stakeholder {
  id: string;
  name: string;
  organization?: string;
}

const CommunicationForm: React.FC<CommunicationFormProps> = ({
  communication,
  onSubmit,
  onCancel,
  stakeholderId,
  loading = false,
}) => {
  const [formData, setFormData] = useState<FormData>({
    communicationType: 'email',
    subject: '',
    summary: '',
    outcome: '',
    occurredAt: new Date().toISOString().slice(0, 16), // Format for datetime-local
    durationMinutes: '',
    location: '',
    participants: [],
    initiatedBy: '',
    followUpRequired: false,
    followUpDate: '',
    sensitiveContent: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [availableStakeholders, setAvailableStakeholders] = useState<Stakeholder[]>([]);
  const [loadingStakeholders, setLoadingStakeholders] = useState(false);

  useEffect(() => {
    loadStakeholders();
  }, []);

  useEffect(() => {
    if (communication) {
      setFormData({
        communicationType: communication.communicationType || 'email',
        subject: communication.subject || '',
        summary: communication.summary || '',
        outcome: communication.outcome || '',
        occurredAt: communication.occurredAt 
          ? new Date(communication.occurredAt).toISOString().slice(0, 16) 
          : new Date().toISOString().slice(0, 16),
        durationMinutes: communication.durationMinutes?.toString() || '',
        location: communication.location || '',
        participants: communication.participants || [],
        initiatedBy: communication.initiatedBy || '',
        followUpRequired: communication.followUpRequired || false,
        followUpDate: communication.followUpDate 
          ? new Date(communication.followUpDate).toISOString().slice(0, 10)
          : '',
        sensitiveContent: communication.sensitiveContent || false,
      });
    } else if (stakeholderId) {
      // If creating a new communication for a specific stakeholder
      setFormData(prev => ({
        ...prev,
        participants: [stakeholderId]
      }));
    }
  }, [communication, stakeholderId]);

  const loadStakeholders = async () => {
    try {
      setLoadingStakeholders(true);
      const response = await stakeholderApi.list({ limit: 100, sort: 'name:asc' });
      if (response.success) {
        setAvailableStakeholders(response.data.items || []);
      }
    } catch (error) {
      console.error('Failed to load stakeholders:', error);
    } finally {
      setLoadingStakeholders(false);
    }
  };

  const communicationTypeOptions = [
    { value: 'email', label: 'Email' },
    { value: 'call', label: 'Phone Call' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'letter', label: 'Letter/Mail' },
  ];

  const stakeholderOptions = availableStakeholders.map(stakeholder => ({
    value: stakeholder.id,
    label: stakeholder.organization 
      ? `${stakeholder.name} (${stakeholder.organization})`
      : stakeholder.name
  }));

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleParticipantChange = (participantIds: string[]) => {
    setFormData(prev => ({ ...prev, participants: participantIds }));
    if (errors.participants) {
      setErrors(prev => ({ ...prev, participants: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.occurredAt) {
      newErrors.occurredAt = 'Date and time is required';
    }

    if (formData.participants.length === 0) {
      newErrors.participants = 'At least one participant is required';
    }

    if (formData.durationMinutes && isNaN(Number(formData.durationMinutes))) {
      newErrors.durationMinutes = 'Duration must be a valid number';
    }

    if (formData.followUpRequired && !formData.followUpDate) {
      newErrors.followUpDate = 'Follow-up date is required when follow-up is needed';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const submitData: Partial<Communication> = {
      communicationType: formData.communicationType,
      subject: formData.subject.trim() || undefined,
      summary: formData.summary.trim() || undefined,
      outcome: formData.outcome.trim() || undefined,
      occurredAt: new Date(formData.occurredAt).toISOString(),
      durationMinutes: formData.durationMinutes ? Number(formData.durationMinutes) : undefined,
      location: formData.location.trim() || undefined,
      participants: formData.participants,
      initiatedBy: formData.initiatedBy || undefined,
      followUpRequired: formData.followUpRequired,
      followUpDate: formData.followUpDate ? new Date(formData.followUpDate).toISOString() : undefined,
      sensitiveContent: formData.sensitiveContent,
    };

    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Communication Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Communication Details
          </h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type *
            </label>
            <Select
              value={formData.communicationType}
              onChange={(value) => handleInputChange('communicationType', value)}
              options={communicationTypeOptions}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date & Time *
            </label>
            <Input
              type="datetime-local"
              value={formData.occurredAt}
              onChange={(e) => handleInputChange('occurredAt', e.target.value)}
              error={errors.occurredAt}
            />
          </div>

          {(formData.communicationType === 'call' || formData.communicationType === 'meeting') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Duration (minutes)
              </label>
              <Input
                type="number"
                value={formData.durationMinutes}
                onChange={(e) => handleInputChange('durationMinutes', e.target.value)}
                error={errors.durationMinutes}
                placeholder="e.g., 30"
              />
            </div>
          )}

          {formData.communicationType === 'meeting' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location
              </label>
              <Input
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="Meeting location or platform"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Subject
            </label>
            <Input
              value={formData.subject}
              onChange={(e) => handleInputChange('subject', e.target.value)}
              placeholder="Communication subject or topic"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Initiated By
            </label>
            <Select
              value={formData.initiatedBy}
              onChange={(value) => handleInputChange('initiatedBy', value)}
              options={[
                { value: '', label: 'Select initiator...' },
                ...stakeholderOptions
              ]}
              loading={loadingStakeholders}
            />
          </div>
        </div>

        {/* Participants & Content */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Participants & Content
          </h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Participants *
            </label>
            <div className="space-y-2">
              {stakeholderOptions.map(option => (
                <label key={option.value} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.participants.includes(option.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleParticipantChange([...formData.participants, option.value]);
                      } else {
                        handleParticipantChange(formData.participants.filter(id => id !== option.value));
                      }
                    }}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
            {errors.participants && (
              <p className="mt-1 text-sm text-red-600">{errors.participants}</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="sensitiveContent"
              checked={formData.sensitiveContent}
              onChange={(e) => handleInputChange('sensitiveContent', e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="sensitiveContent" className="text-sm text-gray-700 dark:text-gray-300">
              Contains sensitive content
            </label>
          </div>
        </div>
      </div>

      {/* Summary and Outcome */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Summary
          </label>
          <textarea
            value={formData.summary}
            onChange={(e) => handleInputChange('summary', e.target.value)}
            rows={4}
            className={cn(
              'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm',
              'focus:ring-primary-500 focus:border-primary-500',
              'dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100'
            )}
            placeholder="Brief summary of the communication..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Outcome
          </label>
          <textarea
            value={formData.outcome}
            onChange={(e) => handleInputChange('outcome', e.target.value)}
            rows={3}
            className={cn(
              'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm',
              'focus:ring-primary-500 focus:border-primary-500',
              'dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100'
            )}
            placeholder="Outcome or next steps from this communication..."
          />
        </div>
      </div>

      {/* Follow-up Section */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="followUpRequired"
            checked={formData.followUpRequired}
            onChange={(e) => handleInputChange('followUpRequired', e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="followUpRequired" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Follow-up required
          </label>
        </div>

        {formData.followUpRequired && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Follow-up Date *
            </label>
            <Input
              type="date"
              value={formData.followUpDate}
              onChange={(e) => handleInputChange('followUpDate', e.target.value)}
              error={errors.followUpDate}
            />
          </div>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          loading={loading}
        >
          {communication ? 'Update' : 'Log'} Communication
        </Button>
      </div>
    </form>
  );
};

export { CommunicationForm };