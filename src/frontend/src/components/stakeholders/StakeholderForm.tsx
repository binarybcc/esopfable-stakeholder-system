import React, { useState, useEffect } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { Card, CardContent } from '../ui/Card';
import { cn } from '@/utils';
import { Stakeholder } from '@/types';

interface StakeholderFormProps {
  stakeholder?: Stakeholder | null;
  onSubmit: (data: Partial<Stakeholder>) => void;
  onCancel: () => void;
  loading?: boolean;
}

interface FormData {
  name: string;
  category: string;
  subcategory: string;
  organization: string;
  title: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  securityLevel: 'standard' | 'restricted' | 'high';
}

const StakeholderForm: React.FC<StakeholderFormProps> = ({
  stakeholder,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    category: '',
    subcategory: '',
    organization: '',
    title: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    securityLevel: 'standard',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [subcategoryOptions, setSubcategoryOptions] = useState<Array<{value: string, label: string}>>([]);

  useEffect(() => {
    if (stakeholder) {
      const contactInfo = typeof stakeholder.contactInfo === 'string' 
        ? JSON.parse(stakeholder.contactInfo) 
        : stakeholder.contactInfo || {};
      
      const metadata = typeof stakeholder.metadata === 'string'
        ? JSON.parse(stakeholder.metadata)
        : stakeholder.metadata || {};

      setFormData({
        name: stakeholder.name || '',
        category: stakeholder.category || '',
        subcategory: stakeholder.subcategory || '',
        organization: stakeholder.organization || '',
        title: stakeholder.title || '',
        email: contactInfo.email || '',
        phone: contactInfo.phone || '',
        address: contactInfo.address || '',
        notes: metadata.notes || '',
        securityLevel: stakeholder.securityLevel || 'standard',
      });
    }
  }, [stakeholder]);

  useEffect(() => {
    updateSubcategoryOptions(formData.category);
  }, [formData.category]);

  const categoryOptions = [
    { value: 'esop_participant', label: 'ESOP Participant' },
    { value: 'government_entity', label: 'Government Entity' },
    { value: 'media_contact', label: 'Media Contact' },
    { value: 'witness', label: 'Witness' },
    { value: 'opposition', label: 'Opposition' },
    { value: 'legal_counsel', label: 'Legal Counsel' },
    { value: 'financial_advisor', label: 'Financial Advisor' },
    { value: 'consultant', label: 'Consultant' },
  ];

  const securityLevelOptions = [
    { value: 'standard', label: 'Standard' },
    { value: 'restricted', label: 'Restricted' },
    { value: 'high', label: 'High Security' },
  ];

  const updateSubcategoryOptions = (category: string) => {
    const subcategories: Record<string, Array<{value: string, label: string}>> = {
      esop_participant: [
        { value: 'current_employee', label: 'Current Employee' },
        { value: 'former_employee', label: 'Former Employee' },
        { value: 'beneficiary', label: 'Beneficiary' },
        { value: 'trustee', label: 'Trustee' },
      ],
      government_entity: [
        { value: 'federal_agency', label: 'Federal Agency' },
        { value: 'state_agency', label: 'State Agency' },
        { value: 'local_government', label: 'Local Government' },
        { value: 'regulatory_body', label: 'Regulatory Body' },
      ],
      media_contact: [
        { value: 'journalist', label: 'Journalist' },
        { value: 'editor', label: 'Editor' },
        { value: 'producer', label: 'Producer' },
        { value: 'blogger', label: 'Blogger' },
      ],
      witness: [
        { value: 'key_witness', label: 'Key Witness' },
        { value: 'expert_witness', label: 'Expert Witness' },
        { value: 'character_witness', label: 'Character Witness' },
      ],
      opposition: [
        { value: 'opposing_party', label: 'Opposing Party' },
        { value: 'opposing_counsel', label: 'Opposing Counsel' },
        { value: 'hostile_witness', label: 'Hostile Witness' },
      ],
    };

    setSubcategoryOptions(subcategories[category] || []);
    if (subcategories[category] && !subcategories[category].find(s => s.value === formData.subcategory)) {
      setFormData(prev => ({ ...prev, subcategory: '' }));
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (formData.phone && !/^[\+]?[1-9][\d\s\-\(\)]{7,14}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const submitData: Partial<Stakeholder> = {
      name: formData.name.trim(),
      category: formData.category,
      subcategory: formData.subcategory || undefined,
      organization: formData.organization.trim() || undefined,
      title: formData.title.trim() || undefined,
      securityLevel: formData.securityLevel,
      contactInfo: {
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        address: formData.address.trim() || undefined,
      },
      metadata: {
        notes: formData.notes.trim() || undefined,
      },
    };

    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Basic Information
          </h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              error={errors.name}
              placeholder="Full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category *
            </label>
            <Select
              value={formData.category}
              onChange={(value) => handleInputChange('category', value)}
              options={categoryOptions}
              error={errors.category}
              placeholder="Select category"
            />
          </div>

          {subcategoryOptions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Subcategory
              </label>
              <Select
                value={formData.subcategory}
                onChange={(value) => handleInputChange('subcategory', value)}
                options={subcategoryOptions}
                placeholder="Select subcategory"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Organization
            </label>
            <Input
              value={formData.organization}
              onChange={(e) => handleInputChange('organization', e.target.value)}
              placeholder="Organization name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title/Position
            </label>
            <Input
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Job title or position"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Security Level
            </label>
            <Select
              value={formData.securityLevel}
              onChange={(value) => handleInputChange('securityLevel', value as 'standard' | 'restricted' | 'high')}
              options={securityLevelOptions}
            />
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Contact Information
          </h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              error={errors.email}
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone
            </label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              error={errors.phone}
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Address
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              rows={3}
              className={cn(
                'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm',
                'focus:ring-primary-500 focus:border-primary-500',
                'dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100'
              )}
              placeholder="Street address, city, state, zip"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={4}
              className={cn(
                'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm',
                'focus:ring-primary-500 focus:border-primary-500',
                'dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100'
              )}
              placeholder="Additional notes or information..."
            />
          </div>
        </div>
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
          {stakeholder ? 'Update' : 'Create'} Stakeholder
        </Button>
      </div>
    </form>
  );
};

export { StakeholderForm };