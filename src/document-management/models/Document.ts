import { Schema, model, Document as MongoDocument } from 'mongoose';
import { 
  Document as IDocument, 
  ClassificationLevel, 
  DocumentStatus, 
  Permission 
} from '../types';

export interface DocumentDocument extends IDocument, MongoDocument {}

const documentVersionSchema = new Schema({
  id: { type: String, required: true },
  documentId: { type: String, required: true },
  version: { type: Number, required: true },
  filename: { type: String, required: true },
  size: { type: Number, required: true },
  checksumSHA256: { type: String, required: true },
  storagePath: { type: String, required: true },
  changes: { type: String },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
});

const documentShareSchema = new Schema({
  id: { type: String, required: true },
  documentId: { type: String, required: true },
  shareToken: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  maxDownloads: { type: Number },
  downloadCount: { type: Number, default: 0 },
  requiresPassword: { type: Boolean, default: false },
  password: { type: String }, // Hashed
  allowedIPs: [{ type: String }],
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  lastAccessedAt: { type: Date }
});

const documentPermissionSchema = new Schema({
  id: { type: String, required: true },
  documentId: { type: String, required: true },
  userId: { type: String },
  roleId: { type: String },
  permissions: [{
    type: String,
    enum: Object.values(Permission)
  }],
  grantedBy: { type: String, required: true },
  grantedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  isActive: { type: Boolean, default: true }
});

const documentActivitySchema = new Schema({
  id: { type: String, required: true },
  documentId: { type: String, required: true },
  userId: { type: String, required: true },
  action: { 
    type: String, 
    required: true,
    enum: ['UPLOAD', 'VIEW', 'DOWNLOAD', 'EDIT', 'DELETE', 'SHARE', 'COMMENT', 'ANNOTATE', 'VERSION_CREATE', 'PERMISSION_GRANT', 'PERMISSION_REVOKE']
  },
  details: { type: Schema.Types.Mixed, default: {} },
  ipAddress: { type: String, required: true },
  userAgent: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const documentSchema = new Schema({
  id: { 
    type: String, 
    required: true, 
    unique: true,
    default: () => require('crypto').randomUUID()
  },
  filename: { type: String, required: true },
  originalFilename: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true, min: 0 },
  classification: {
    type: String,
    required: true,
    enum: Object.values(ClassificationLevel),
    default: ClassificationLevel.INTERNAL
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(DocumentStatus),
    default: DocumentStatus.UPLOADING
  },
  encryptionKey: { type: String, required: true }, // Reference to encrypted key
  checksumSHA256: { type: String, required: true },
  checksumMD5: { type: String, required: true },
  
  // Metadata
  title: { type: String },
  description: { type: String },
  tags: [{ type: String }],
  category: { type: String },
  author: { type: String, required: true }, // User ID
  
  // Processing status
  virusScanStatus: {
    type: String,
    enum: ['PENDING', 'CLEAN', 'INFECTED', 'ERROR'],
    default: 'PENDING'
  },
  ocrStatus: {
    type: String,
    enum: ['PENDING', 'COMPLETE', 'ERROR', 'NOT_APPLICABLE'],
    default: 'PENDING'
  },
  previewStatus: {
    type: String,
    enum: ['PENDING', 'COMPLETE', 'ERROR', 'NOT_APPLICABLE'],
    default: 'PENDING'
  },
  
  // File paths (all encrypted)
  storagePath: { type: String, required: true },
  previewPath: { type: String },
  thumbnailPath: { type: String },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  accessedAt: { type: Date, default: Date.now },
  
  // Relationships
  parentId: { type: String }, // For versions
  currentVersionId: { type: String },
  versions: [documentVersionSchema],
  shares: [documentShareSchema],
  activities: [documentActivitySchema],
  permissions: [documentPermissionSchema]
}, {
  timestamps: true,
  collection: 'documents'
});

// Indexes for performance
documentSchema.index({ author: 1, createdAt: -1 });
documentSchema.index({ classification: 1, status: 1 });
documentSchema.index({ tags: 1 });
documentSchema.index({ category: 1 });
documentSchema.index({ 'shares.shareToken': 1 });
documentSchema.index({ 'shares.expiresAt': 1 });
documentSchema.index({ parentId: 1, 'versions.version': -1 });
documentSchema.index({ checksumSHA256: 1 });
documentSchema.index({ originalFilename: 'text', title: 'text', description: 'text', tags: 'text' });

// Pre-save middleware
documentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Methods
documentSchema.methods.hasPermission = function(userId: string, permission: Permission): boolean {
  const userPermissions = this.permissions.find(p => 
    p.userId === userId && 
    p.isActive && 
    (!p.expiresAt || p.expiresAt > new Date())
  );
  
  if (userPermissions) {
    return userPermissions.permissions.includes(permission);
  }
  
  return false;
};

documentSchema.methods.addActivity = function(userId: string, action: string, details: any, ipAddress: string, userAgent: string) {
  this.activities.push({
    id: require('crypto').randomUUID(),
    documentId: this.id,
    userId,
    action,
    details,
    ipAddress,
    userAgent,
    timestamp: new Date()
  });
  
  this.accessedAt = new Date();
  return this.save();
};

documentSchema.methods.createVersion = function(filename: string, size: number, checksum: string, storagePath: string, createdBy: string, changes?: string) {
  const version = this.versions.length + 1;
  const versionId = require('crypto').randomUUID();
  
  this.versions.push({
    id: versionId,
    documentId: this.id,
    version,
    filename,
    size,
    checksumSHA256: checksum,
    storagePath,
    changes,
    createdBy,
    createdAt: new Date(),
    isActive: true
  });
  
  // Update current version
  this.currentVersionId = versionId;
  this.filename = filename;
  this.size = size;
  this.checksumSHA256 = checksum;
  this.storagePath = storagePath;
  
  return this.save();
};

documentSchema.methods.createShare = function(expiresAt: Date, maxDownloads?: number, requiresPassword = false, password?: string, allowedIPs?: string[], createdBy: string) {
  const shareToken = require('crypto').randomBytes(32).toString('hex');
  const shareId = require('crypto').randomUUID();
  
  this.shares.push({
    id: shareId,
    documentId: this.id,
    shareToken,
    expiresAt,
    maxDownloads,
    downloadCount: 0,
    requiresPassword,
    password: password ? require('bcrypt').hashSync(password, 12) : undefined,
    allowedIPs,
    createdBy,
    createdAt: new Date(),
    isActive: true
  });
  
  return this.save().then(() => shareToken);
};

documentSchema.methods.grantPermission = function(userId: string, permissions: Permission[], grantedBy: string, expiresAt?: Date) {
  // Remove existing permissions for this user
  this.permissions = this.permissions.filter(p => p.userId !== userId || !p.isActive);
  
  this.permissions.push({
    id: require('crypto').randomUUID(),
    documentId: this.id,
    userId,
    permissions,
    grantedBy,
    grantedAt: new Date(),
    expiresAt,
    isActive: true
  });
  
  return this.save();
};

documentSchema.methods.revokePermission = function(userId: string) {
  this.permissions.forEach(p => {
    if (p.userId === userId) {
      p.isActive = false;
    }
  });
  
  return this.save();
};

// Static methods
documentSchema.statics.findByClassification = function(classification: ClassificationLevel, userId?: string) {
  const query: any = { classification, status: { $ne: DocumentStatus.DELETED } };
  
  if (userId) {
    query.$or = [
      { author: userId },
      { 'permissions.userId': userId, 'permissions.isActive': true }
    ];
  }
  
  return this.find(query);
};

documentSchema.statics.findShared = function(shareToken: string) {
  return this.findOne({
    'shares.shareToken': shareToken,
    'shares.isActive': true,
    'shares.expiresAt': { $gt: new Date() },
    status: { $ne: DocumentStatus.DELETED }
  });
};

documentSchema.statics.search = function(query: string, filters: any = {}) {
  const searchQuery: any = {
    $and: [
      { status: { $ne: DocumentStatus.DELETED } },
      { $text: { $search: query } }
    ]
  };
  
  if (filters.classification) {
    searchQuery.$and.push({ classification: { $in: filters.classification } });
  }
  
  if (filters.category) {
    searchQuery.$and.push({ category: { $in: filters.category } });
  }
  
  if (filters.tags && filters.tags.length > 0) {
    searchQuery.$and.push({ tags: { $in: filters.tags } });
  }
  
  if (filters.author) {
    searchQuery.$and.push({ author: { $in: filters.author } });
  }
  
  if (filters.dateRange) {
    const dateFilter: any = {};
    if (filters.dateRange.from) dateFilter.$gte = filters.dateRange.from;
    if (filters.dateRange.to) dateFilter.$lte = filters.dateRange.to;
    searchQuery.$and.push({ createdAt: dateFilter });
  }
  
  if (filters.mimeType) {
    searchQuery.$and.push({ mimeType: { $in: filters.mimeType } });
  }
  
  if (filters.size) {
    const sizeFilter: any = {};
    if (filters.size.min !== undefined) sizeFilter.$gte = filters.size.min;
    if (filters.size.max !== undefined) sizeFilter.$lte = filters.size.max;
    searchQuery.$and.push({ size: sizeFilter });
  }
  
  return this.find(searchQuery, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } });
};

export const Document = model<DocumentDocument>('Document', documentSchema);