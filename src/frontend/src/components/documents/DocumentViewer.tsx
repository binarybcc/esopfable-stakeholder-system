import React, { useState, useEffect } from 'react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { cn, formatFileSize, formatDate, getClassificationColor } from '@/utils';
import { Document } from '@/types';
import { documentApi } from '@/services/api';
import { useRoleBasedContent } from '@/hooks/useRoleBasedContent';

interface DocumentViewerProps {
  document: Document;
  onClose: () => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ document, onClose }) => {
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWatermark, setShowWatermark] = useState(false);
  const { contentFilters, featureFlags } = useRoleBasedContent();

  useEffect(() => {
    loadDocument();
    setShowWatermark(contentFilters.watermarkRequired);
  }, [document.id]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if user has permission to view this document
      const hasAccess = checkDocumentAccess();
      if (!hasAccess) {
        setError('You do not have permission to view this document.');
        return;
      }

      const response = await documentApi.download(document.id);
      const blob = new Blob([response.data], { type: document.mimeType });
      const url = window.URL.createObjectURL(blob);
      setViewUrl(url);
    } catch (error) {
      console.error('Failed to load document:', error);
      setError('Failed to load document. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const checkDocumentAccess = (): boolean => {
    // Check if user can access documents based on classification
    const userRole = contentFilters.role;
    
    switch (document.classification) {
      case 'secret':
        return ['legal_team'].includes(userRole);
      case 'confidential':
        return ['legal_team', 'government_entity'].includes(userRole);
      case 'internal':
        return !['opposition', 'media_contact', 'public'].includes(userRole);
      case 'public':
      default:
        return true;
    }
  };

  const handleDownload = async () => {
    if (!featureFlags.canDownloadDocuments) {
      alert('You do not have permission to download documents.');
      return;
    }

    try {
      const response = await documentApi.download(document.id);
      const blob = new Blob([response.data], { type: document.mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.title;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download document:', error);
    }
  };

  const getFileIcon = (mimeType: string): string => {
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('video')) return '🎥';
    if (mimeType.includes('audio')) return '🎵';
    return '📁';
  };

  const canPreview = (mimeType: string): boolean => {
    return (
      mimeType.includes('pdf') ||
      mimeType.includes('image') ||
      mimeType.includes('text')
    );
  };

  const renderPreview = () => {
    if (!viewUrl) return null;

    if (document.mimeType.includes('pdf')) {
      return (
        <div className="relative w-full h-full">
          <iframe
            src={viewUrl}
            className="w-full h-full border-0"
            title={document.title}
          />
          {showWatermark && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-4 right-4 bg-black/10 text-white px-2 py-1 rounded text-xs font-mono">
                CONFIDENTIAL - {new Date().toISOString().split('T')[0]}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (document.mimeType.includes('image')) {
      return (
        <div className="relative flex items-center justify-center h-full">
          <img
            src={viewUrl}
            alt={document.title}
            className="max-w-full max-h-full object-contain"
          />
          {showWatermark && (
            <div className="absolute top-4 right-4 bg-black/70 text-white px-2 py-1 rounded text-xs font-mono">
              CONFIDENTIAL
            </div>
          )}
        </div>
      );
    }

    if (document.mimeType.includes('text')) {
      return (
        <div className="relative p-4 h-full overflow-auto">
          <iframe
            src={viewUrl}
            className="w-full h-full border-0 bg-white"
            title={document.title}
          />
          {showWatermark && (
            <div className="absolute top-4 right-4 bg-gray-800/70 text-white px-2 py-1 rounded text-xs font-mono">
              CONFIDENTIAL
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="text-6xl">{getFileIcon(document.mimeType)}</div>
          <p className="text-gray-500">Preview not available for this file type</p>
          <Button onClick={handleDownload} disabled={!featureFlags.canDownloadDocuments}>
            Download to View
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="text-red-500 text-4xl">⚠️</div>
          <p className="text-red-600">{error}</p>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      {/* Document Header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">{getFileIcon(document.mimeType)}</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {document.title}
              </h3>
              {document.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {document.description}
                </p>
              )}
              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                <span>Size: {formatFileSize(document.fileSize)}</span>
                <span>Version: {document.versionNumber}</span>
                <span>Updated: {formatDate(document.updatedAt)}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge className={getClassificationColor(document.classification)}>
              {document.classification}
            </Badge>
            {showWatermark && (
              <Badge variant="warning" size="sm">
                Watermarked
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Document Content */}
      <div className="flex-1 overflow-hidden">
        {canPreview(document.mimeType) ? (
          renderPreview()
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <div className="text-6xl">{getFileIcon(document.mimeType)}</div>
              <div>
                <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {document.title}
                </p>
                <p className="text-gray-500">
                  {formatFileSize(document.fileSize)} • {document.mimeType}
                </p>
              </div>
              <p className="text-gray-500">Preview not available for this file type</p>
              {featureFlags.canDownloadDocuments ? (
                <Button onClick={handleDownload}>
                  Download File
                </Button>
              ) : (
                <p className="text-sm text-red-600">
                  You do not have permission to download this file
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Document Actions */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {document.encryptionKeyId && (
              <Badge variant="secondary" size="sm">
                🔒 Encrypted
              </Badge>
            )}
            {contentFilters.watermarkRequired && (
              <Badge variant="warning" size="sm">
                📎 Watermarked
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {featureFlags.canDownloadDocuments && (
              <Button variant="outline" size="sm" onClick={handleDownload}>
                Download
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>

      {/* Access Warning */}
      {showWatermark && (
        <div className="flex-shrink-0 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800 p-2">
          <div className="flex items-center space-x-2 text-xs text-yellow-800 dark:text-yellow-200">
            <span>⚠️</span>
            <span>
              This document is watermarked and access is being logged for security purposes.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Hook to get role-based content (simplified version for this component)
function useRoleBasedContent() {
  // This would normally come from your auth context
  // For now, returning basic configuration
  return {
    contentFilters: {
      role: 'legal_team' as any, // This should come from actual auth
      watermarkRequired: true,
    },
    featureFlags: {
      canDownloadDocuments: true,
      canViewProgressReports: true,
    }
  };
}

export { DocumentViewer };