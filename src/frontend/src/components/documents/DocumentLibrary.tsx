import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import { cn, formatDate, formatFileSize, getClassificationColor } from '@/utils';
import { Document, FilterOptions, SortOption, PaginationState } from '@/types';
import { documentApi, searchApi } from '@/services/api';
import { useSocket } from '@/hooks/useSocket';
import { useDebounce } from '@/hooks/useDebounce';
import { DocumentUploadForm } from './DocumentUploadForm';
import { DocumentViewer } from './DocumentViewer';

interface DocumentLibraryProps {
  className?: string;
}

const DocumentLibrary: React.FC<DocumentLibraryProps> = ({ className }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterOptions>({});
  const [sort, setSort] = useState<SortOption>({ field: 'createdAt', direction: 'desc' });
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, pageSize: 20, total: 0 });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const socket = useSocket();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocuments();
  }, [debouncedSearchQuery, filters, sort, pagination.page, pagination.pageSize]);

  useEffect(() => {
    if (socket) {
      socket.on('document_uploaded', handleDocumentUploaded);
      socket.on('document_updated', handleDocumentUpdated);
      socket.on('document_deleted', handleDocumentDeleted);

      return () => {
        socket.off('document_uploaded');
        socket.off('document_updated');
        socket.off('document_deleted');
      };
    }
  }, [socket]);

  const loadDocuments = async () => {
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
        ? await searchApi.documents(debouncedSearchQuery, params)
        : await documentApi.list(params);

      if (response.success) {
        setDocuments(response.data.items || []);
        setPagination(prev => ({
          ...prev,
          total: response.data.total || 0
        }));
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUploaded = (document: Document) => {
    setDocuments(prev => [document, ...prev]);
    setPagination(prev => ({ ...prev, total: prev.total + 1 }));
  };

  const handleDocumentUpdated = (updatedDocument: Document) => {
    setDocuments(prev => prev.map(d => 
      d.id === updatedDocument.id ? updatedDocument : d
    ));
  };

  const handleDocumentDeleted = (documentId: string) => {
    setDocuments(prev => prev.filter(d => d.id !== documentId));
    setPagination(prev => ({ ...prev, total: prev.total - 1 }));
  };

  const handleViewDocument = (document: Document) => {
    setSelectedDocument(document);
    setIsViewerOpen(true);
  };

  const handleDownloadDocument = async (document: Document) => {
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

  const handleDeleteDocument = (document: Document) => {
    setDocumentToDelete(document);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!documentToDelete) return;
    
    try {
      const response = await documentApi.delete(documentToDelete.id);
      if (response.success) {
        handleDocumentDeleted(documentToDelete.id);
        setIsDeleteModalOpen(false);
        setDocumentToDelete(null);
      }
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  const handleUploadSuccess = (document: Document) => {
    handleDocumentUploaded(document);
    setIsUploadModalOpen(false);
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const classificationOptions = [
    { value: '', label: 'All Classifications' },
    { value: 'public', label: 'Public' },
    { value: 'internal', label: 'Internal' },
    { value: 'confidential', label: 'Confidential' },
    { value: 'secret', label: 'Secret' },
  ];

  const mimeTypeOptions = [
    { value: '', label: 'All File Types' },
    { value: 'application/pdf', label: 'PDF' },
    { value: 'application/msword', label: 'Word Document' },
    { value: 'application/vnd.ms-excel', label: 'Excel Spreadsheet' },
    { value: 'image/jpeg', label: 'JPEG Image' },
    { value: 'image/png', label: 'PNG Image' },
    { value: 'text/plain', label: 'Text File' },
  ];

  const getFileIcon = (mimeType: string): string => {
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('video')) return '🎥';
    if (mimeType.includes('audio')) return '🎵';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦';
    return '📁';
  };

  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {documents.map(document => (
        <Card key={document.id} className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{getFileIcon(document.mimeType)}</span>
              <Badge className={getClassificationColor(document.classification)}>
                {document.classification}
              </Badge>
            </div>
            
            <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">
              {document.title}
            </h3>
            
            {document.description && (
              <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                {document.description}
              </p>
            )}
            
            <div className="space-y-1 text-xs text-gray-500">
              <div>Size: {formatFileSize(document.fileSize)}</div>
              <div>Version: {document.versionNumber}</div>
              <div>Updated: {formatDate(document.updatedAt)}</div>
            </div>
            
            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleViewDocument(document)}
              >
                View
              </Button>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownloadDocument(document)}
                  className="p-1"
                >
                  ⬇️
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteDocument(document)}
                  className="p-1 text-red-600 hover:text-red-700"
                >
                  🗑️
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderListView = () => (
    <div className="space-y-2">
      {documents.map(document => (
        <Card key={document.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1">
                <span className="text-lg">{getFileIcon(document.mimeType)}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                    {document.title}
                  </h3>
                  <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                    <span>{formatFileSize(document.fileSize)}</span>
                    <span>v{document.versionNumber}</span>
                    <span>{formatDate(document.updatedAt)}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Badge className={getClassificationColor(document.classification)}>
                  {document.classification}
                </Badge>
                
                <div className="flex items-center space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDocument(document)}
                  >
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadDocument(document)}
                    className="p-2"
                  >
                    ⬇️
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteDocument(document)}
                    className="p-2 text-red-600 hover:text-red-700"
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Document Library
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage and organize case documents
          </p>
        </div>
        <Button onClick={() => setIsUploadModalOpen(true)}>
          Upload Document
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex-1 max-w-md">
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Select
                value={filters.classification?.[0] || ''}
                onChange={(value) => setFilters(prev => ({
                  ...prev,
                  classification: value ? [value] : undefined
                }))}
                options={classificationOptions}
                className="min-w-[150px]"
              />
              <Select
                value={filters.mimeType || ''}
                onChange={(value) => setFilters(prev => ({
                  ...prev,
                  mimeType: value || undefined
                }))}
                options={mimeTypeOptions}
                className="min-w-[150px]"
              />
              <div className="flex items-center border border-gray-300 rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  ⊞
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  ☰
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No documents found</p>
            </div>
          ) : (
            <div>
              {viewMode === 'grid' ? renderGridView() : renderListView()}
              
              {pagination.total > pagination.pageSize && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t">
                  <p className="text-sm text-gray-500">
                    Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} documents
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Document"
        size="lg"
      >
        <DocumentUploadForm
          onSuccess={handleUploadSuccess}
          onCancel={() => setIsUploadModalOpen(false)}
        />
      </Modal>

      {/* Document Viewer Modal */}
      <Modal
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        title={selectedDocument?.title || 'Document Viewer'}
        size="xl"
      >
        {selectedDocument && (
          <DocumentViewer
            document={selectedDocument}
            onClose={() => setIsViewerOpen(false)}
          />
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Document"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete <strong>{documentToDelete?.title}</strong>?
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

export default DocumentLibrary;