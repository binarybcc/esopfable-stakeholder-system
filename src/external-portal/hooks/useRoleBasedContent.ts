import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  StakeholderRole, 
  DashboardSection, 
  ContentFilter,
  MaskedField 
} from '../types/stakeholder';

interface RoleBasedContentConfig {
  allowedSections: DashboardSection[];
  contentFilters: ContentFilter;
  navigationItems: NavigationItem[];
  featureFlags: Record<string, boolean>;
}

interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon?: string;
  badge?: string;
  children?: NavigationItem[];
}

export function useRoleBasedContent(): RoleBasedContentConfig {
  const { state } = useAuth();
  const userRole = state.user?.role;

  const config = useMemo((): RoleBasedContentConfig => {
    if (!userRole) {
      return getPublicConfig();
    }

    switch (userRole) {
      case StakeholderRole.ESOP_PARTICIPANT:
        return getESOPParticipantConfig();
      
      case StakeholderRole.GOVERNMENT_ENTITY:
        return getGovernmentEntityConfig();
      
      case StakeholderRole.MEDIA_CONTACT:
        return getMediaContactConfig();
      
      case StakeholderRole.KEY_WITNESS:
        return getKeyWitnessConfig();
      
      case StakeholderRole.OPPOSITION:
        return getOppositionConfig();
      
      default:
        return getPublicConfig();
    }
  }, [userRole]);

  return config;
}

function getESOPParticipantConfig(): RoleBasedContentConfig {
  return {
    allowedSections: [
      DashboardSection.CASE_UPDATES,
      DashboardSection.COMMUNICATIONS,
      DashboardSection.GROUP_MESSAGING,
      DashboardSection.DOCUMENT_ACCESS
    ],
    contentFilters: {
      role: StakeholderRole.ESOP_PARTICIPANT,
      allowedFields: [
        'case_status',
        'general_updates',
        'participant_communications',
        'group_messages',
        'approved_documents'
      ],
      hiddenFields: [
        'internal_notes',
        'legal_strategy',
        'witness_details',
        'confidential_evidence'
      ],
      maskedFields: [
        {
          field: 'financial_details',
          maskType: 'partial',
          maskPattern: 'show_totals_only'
        }
      ],
      watermarkRequired: true
    },
    navigationItems: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        path: '/dashboard',
        icon: 'dashboard'
      },
      {
        id: 'updates',
        label: 'Case Updates',
        path: '/updates',
        icon: 'notifications'
      },
      {
        id: 'communications',
        label: 'Communications',
        path: '/communications',
        icon: 'message',
        children: [
          {
            id: 'group-chat',
            label: 'Group Messages',
            path: '/communications/group',
            icon: 'group'
          },
          {
            id: 'announcements',
            label: 'Announcements',
            path: '/communications/announcements',
            icon: 'campaign'
          }
        ]
      },
      {
        id: 'documents',
        label: 'Documents',
        path: '/documents',
        icon: 'folder'
      }
    ],
    featureFlags: {
      canSubmitEvidence: false,
      canAccessLegalDocuments: true,
      canViewProgressReports: true,
      canParticipateInGroupChat: true,
      canDownloadDocuments: true
    }
  };
}

function getGovernmentEntityConfig(): RoleBasedContentConfig {
  return {
    allowedSections: [
      DashboardSection.COORDINATION,
      DashboardSection.DOCUMENT_ACCESS,
      DashboardSection.PROGRESS_TRACKING,
      DashboardSection.COMMUNICATIONS
    ],
    contentFilters: {
      role: StakeholderRole.GOVERNMENT_ENTITY,
      allowedFields: [
        'case_status',
        'progress_reports',
        'coordination_updates',
        'legal_documents',
        'compliance_reports'
      ],
      hiddenFields: [
        'witness_identities',
        'internal_strategy'
      ],
      maskedFields: [
        {
          field: 'sensitive_evidence',
          maskType: 'redacted',
        }
      ],
      watermarkRequired: true
    },
    navigationItems: [
      {
        id: 'coordination',
        label: 'Coordination',
        path: '/coordination',
        icon: 'sync'
      },
      {
        id: 'progress',
        label: 'Progress Tracking',
        path: '/progress',
        icon: 'timeline'
      },
      {
        id: 'documents',
        label: 'Document Sharing',
        path: '/documents',
        icon: 'share'
      },
      {
        id: 'reports',
        label: 'Reports',
        path: '/reports',
        icon: 'assessment'
      }
    ],
    featureFlags: {
      canSubmitEvidence: false,
      canAccessLegalDocuments: true,
      canViewProgressReports: true,
      canCoordinateActivities: true,
      canGenerateReports: true
    }
  };
}

function getMediaContactConfig(): RoleBasedContentConfig {
  return {
    allowedSections: [
      DashboardSection.PRESS_RELEASES,
      DashboardSection.PUBLIC_INFO
    ],
    contentFilters: {
      role: StakeholderRole.MEDIA_CONTACT,
      allowedFields: [
        'press_releases',
        'public_statements',
        'media_kit',
        'contact_information'
      ],
      hiddenFields: [
        'internal_communications',
        'case_details',
        'participant_information',
        'evidence',
        'legal_strategy'
      ],
      maskedFields: [],
      watermarkRequired: true
    },
    navigationItems: [
      {
        id: 'press',
        label: 'Press Releases',
        path: '/press',
        icon: 'newspaper'
      },
      {
        id: 'statements',
        label: 'Public Statements',
        path: '/statements',
        icon: 'record_voice_over'
      },
      {
        id: 'media-kit',
        label: 'Media Kit',
        path: '/media-kit',
        icon: 'folder_special'
      },
      {
        id: 'contact',
        label: 'Contact Form',
        path: '/contact',
        icon: 'contact_mail'
      }
    ],
    featureFlags: {
      canSubmitEvidence: false,
      canAccessLegalDocuments: false,
      canViewProgressReports: false,
      canAccessMediaKit: true,
      canSubmitMediaRequests: true
    }
  };
}

function getKeyWitnessConfig(): RoleBasedContentConfig {
  return {
    allowedSections: [
      DashboardSection.EVIDENCE_SUBMISSION,
      DashboardSection.PROTECTION_STATUS,
      DashboardSection.COMMUNICATIONS
    ],
    contentFilters: {
      role: StakeholderRole.KEY_WITNESS,
      allowedFields: [
        'evidence_submission',
        'protection_status',
        'secure_communications',
        'safety_updates'
      ],
      hiddenFields: [
        'other_witnesses',
        'case_strategy',
        'participant_details'
      ],
      maskedFields: [
        {
          field: 'location_information',
          maskType: 'redacted'
        }
      ],
      watermarkRequired: true
    },
    navigationItems: [
      {
        id: 'evidence',
        label: 'Submit Evidence',
        path: '/evidence',
        icon: 'upload_file'
      },
      {
        id: 'protection',
        label: 'Protection Status',
        path: '/protection',
        icon: 'security'
      },
      {
        id: 'secure-chat',
        label: 'Secure Communications',
        path: '/secure-chat',
        icon: 'lock'
      }
    ],
    featureFlags: {
      canSubmitEvidence: true,
      canAccessLegalDocuments: false,
      canViewProgressReports: false,
      canViewProtectionStatus: true,
      canUseSecureMessaging: true
    }
  };
}

function getOppositionConfig(): RoleBasedContentConfig {
  return {
    allowedSections: [
      DashboardSection.PUBLIC_INFO
    ],
    contentFilters: {
      role: StakeholderRole.OPPOSITION,
      allowedFields: [
        'public_statements',
        'court_filings_public',
        'general_updates'
      ],
      hiddenFields: [
        'internal_communications',
        'case_details',
        'participant_information',
        'evidence',
        'legal_strategy',
        'witness_information',
        'protection_details'
      ],
      maskedFields: [],
      watermarkRequired: true
    },
    navigationItems: [
      {
        id: 'public-info',
        label: 'Public Information',
        path: '/public-info',
        icon: 'public'
      }
    ],
    featureFlags: {
      canSubmitEvidence: false,
      canAccessLegalDocuments: false,
      canViewProgressReports: false,
      canViewPublicInfo: true
    }
  };
}

function getPublicConfig(): RoleBasedContentConfig {
  return {
    allowedSections: [
      DashboardSection.PUBLIC_INFO
    ],
    contentFilters: {
      role: StakeholderRole.PUBLIC,
      allowedFields: [
        'public_statements',
        'general_information'
      ],
      hiddenFields: [
        'case_details',
        'participant_information',
        'internal_communications',
        'evidence',
        'legal_documents'
      ],
      maskedFields: [],
      watermarkRequired: false
    },
    navigationItems: [
      {
        id: 'info',
        label: 'Information',
        path: '/info',
        icon: 'info'
      }
    ],
    featureFlags: {
      canSubmitEvidence: false,
      canAccessLegalDocuments: false,
      canViewProgressReports: false,
      canViewPublicInfo: true
    }
  };
}

export function useContentFilter<T>(data: T): T {
  const { contentFilters } = useRoleBasedContent();
  
  return useMemo(() => {
    if (!data || typeof data !== 'object') return data;
    
    const filtered = { ...data } as any;
    
    // Remove hidden fields
    contentFilters.hiddenFields.forEach(field => {
      delete filtered[field];
    });
    
    // Apply masking to masked fields
    contentFilters.maskedFields.forEach((maskedField: MaskedField) => {
      if (filtered[maskedField.field] !== undefined) {
        filtered[maskedField.field] = applyMask(
          filtered[maskedField.field],
          maskedField.maskType,
          maskedField.maskPattern
        );
      }
    });
    
    return filtered as T;
  }, [data, contentFilters]);
}

function applyMask(value: any, maskType: string, maskPattern?: string): any {
  switch (maskType) {
    case 'partial':
      if (typeof value === 'string') {
        return value.length > 4 
          ? value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2)
          : '***';
      }
      return value;
    
    case 'redacted':
      return '[REDACTED]';
    
    case 'summarized':
      return '[SUMMARY AVAILABLE]';
    
    default:
      return value;
  }
}