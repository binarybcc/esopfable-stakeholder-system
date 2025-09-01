import { ClassificationLevel, User, Document } from '../../document-management/types';

// Core Evidence Types
export interface Evidence {
  id: string;
  caseId: string;
  evidenceNumber: string;
  title: string;
  description: string;
  
  // Evidence Classification
  type: EvidenceType;
  category: EvidenceCategory;
  classification: ClassificationLevel;
  sensitivity: SensitivityLevel;
  
  // Physical Properties
  isDigital: boolean;
  originalFormat?: string;
  physicalLocation?: string;
  dimensions?: string;
  weight?: number;
  
  // Digital Properties
  fileHash?: string;
  fileSize?: number;
  mimeType?: string;
  digitalFingerprint: DigitalFingerprint;
  
  // Chain of Custody
  custodyChain: CustodyRecord[];
  currentCustodian: string;
  custodyStatus: CustodyStatus;
  
  // Integrity
  integrityProof: IntegrityProof;
  tamperChecks: TamperCheck[];
  
  // Legal
  collectionMethod: CollectionMethod;
  collectionDate: Date;
  collectedBy: string;
  collectionLocation: string;
  legalHold: boolean;
  preservationOrder?: PreservationOrder;
  
  // Relationships
  parentEvidenceId?: string;
  childEvidenceIds: string[];
  relatedEvidenceIds: string[];
  associatedDocuments: string[]; // Document IDs
  
  // Witness Information (Anonymized)
  witnessInfo?: AnonymizedWitnessInfo;
  sourceProtection: SourceProtection;
  
  // Status and Lifecycle
  status: EvidenceStatus;
  lifecycle: EvidenceLifecycle[];
  destructionDate?: Date;
  destructionMethod?: string;
  
  // Metadata
  tags: string[];
  keywords: string[];
  jurisdiction: string[];
  relevantStatutes: string[];
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
  lastIntegrityCheck: Date;
}

export enum EvidenceType {
  PHYSICAL = 'PHYSICAL',
  DIGITAL = 'DIGITAL',
  DOCUMENTARY = 'DOCUMENTARY',
  TESTIMONIAL = 'TESTIMONIAL',
  DEMONSTRATIVE = 'DEMONSTRATIVE',
  REAL = 'REAL',
  CIRCUMSTANTIAL = 'CIRCUMSTANTIAL'
}

export enum EvidenceCategory {
  WEAPON = 'WEAPON',
  DOCUMENT = 'DOCUMENT',
  PHOTOGRAPH = 'PHOTOGRAPH',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  COMPUTER_FILE = 'COMPUTER_FILE',
  EMAIL = 'EMAIL',
  TEXT_MESSAGE = 'TEXT_MESSAGE',
  PHONE_RECORD = 'PHONE_RECORD',
  FINANCIAL_RECORD = 'FINANCIAL_RECORD',
  DNA = 'DNA',
  FINGERPRINT = 'FINGERPRINT',
  DRUG = 'DRUG',
  OTHER = 'OTHER'
}

export enum SensitivityLevel {
  PUBLIC = 'PUBLIC',
  SENSITIVE = 'SENSITIVE',
  RESTRICTED = 'RESTRICTED',
  CONFIDENTIAL = 'CONFIDENTIAL',
  SECRET = 'SECRET',
  TOP_SECRET = 'TOP_SECRET'
}

export enum CustodyStatus {
  ACTIVE = 'ACTIVE',
  TRANSFERRED = 'TRANSFERRED',
  RETURNED = 'RETURNED',
  DESTROYED = 'DESTROYED',
  LOST = 'LOST',
  COMPROMISED = 'COMPROMISED'
}

export enum EvidenceStatus {
  COLLECTED = 'COLLECTED',
  PROCESSING = 'PROCESSING',
  ANALYZED = 'ANALYZED',
  READY = 'READY',
  PRESENTED = 'PRESENTED',
  ARCHIVED = 'ARCHIVED',
  DESTROYED = 'DESTROYED',
  DISPUTED = 'DISPUTED'
}

export enum CollectionMethod {
  SEARCH_WARRANT = 'SEARCH_WARRANT',
  CONSENT_SEARCH = 'CONSENT_SEARCH',
  PLAIN_VIEW = 'PLAIN_VIEW',
  INCIDENT_TO_ARREST = 'INCIDENT_TO_ARREST',
  VOLUNTARY_SURRENDER = 'VOLUNTARY_SURRENDER',
  SUBPOENA = 'SUBPOENA',
  COURT_ORDER = 'COURT_ORDER',
  PRESERVATION_NOTICE = 'PRESERVATION_NOTICE',
  OTHER = 'OTHER'
}

// Chain of Custody
export interface CustodyRecord {
  id: string;
  evidenceId: string;
  custodian: string; // User ID or external entity
  custodianName: string;
  custodianBadge?: string;
  custodianOrganization: string;
  
  // Transfer Information
  transferredFrom?: string;
  transferredTo?: string;
  transferReason: TransferReason;
  transferMethod: TransferMethod;
  
  // Timing
  receivedAt: Date;
  releasedAt?: Date;
  
  // Location
  storageLocation: string;
  storageConditions: StorageConditions;
  
  // Purpose
  purpose: CustodyPurpose;
  activities: CustodyActivity[];
  
  // Integrity
  conditionOnReceipt: string;
  conditionOnRelease?: string;
  integrityVerified: boolean;
  integrityNotes?: string;
  
  // Digital Signature
  digitalSignature: DigitalSignature;
  witnessSignature?: DigitalSignature;
  
  // Documentation
  photos?: string[];
  documentation?: string[];
  notes: string;
  
  createdAt: Date;
}

export enum TransferReason {
  ANALYSIS = 'ANALYSIS',
  STORAGE = 'STORAGE',
  COURT_PRESENTATION = 'COURT_PRESENTATION',
  RETURN_TO_OWNER = 'RETURN_TO_OWNER',
  DESTRUCTION = 'DESTRUCTION',
  INVESTIGATION = 'INVESTIGATION',
  OTHER = 'OTHER'
}

export enum TransferMethod {
  HAND_DELIVERY = 'HAND_DELIVERY',
  SECURE_TRANSPORT = 'SECURE_TRANSPORT',
  MAIL_REGISTERED = 'MAIL_REGISTERED',
  COURIER = 'COURIER',
  DIGITAL_TRANSFER = 'DIGITAL_TRANSFER',
  OTHER = 'OTHER'
}

export enum CustodyPurpose {
  COLLECTION = 'COLLECTION',
  ANALYSIS = 'ANALYSIS',
  STORAGE = 'STORAGE',
  EXAMINATION = 'EXAMINATION',
  PRESENTATION = 'PRESENTATION',
  PRESERVATION = 'PRESERVATION',
  DESTRUCTION = 'DESTRUCTION'
}

export interface CustodyActivity {
  id: string;
  type: ActivityType;
  description: string;
  performedBy: string;
  performedAt: Date;
  duration?: number; // minutes
  tools?: string[];
  results?: string;
  photos?: string[];
  notes?: string;
}

export enum ActivityType {
  EXAMINATION = 'EXAMINATION',
  TESTING = 'TESTING',
  PHOTOGRAPHING = 'PHOTOGRAPHING',
  SAMPLING = 'SAMPLING',
  COPYING = 'COPYING',
  ANALYSIS = 'ANALYSIS',
  MAINTENANCE = 'MAINTENANCE',
  VIEWING = 'VIEWING',
  OTHER = 'OTHER'
}

export interface StorageConditions {
  temperature?: number;
  humidity?: number;
  lightExposure: 'DARK' | 'LOW' | 'NORMAL' | 'HIGH';
  security: SecurityLevel;
  access: AccessLevel;
  specialRequirements?: string[];
}

export enum SecurityLevel {
  BASIC = 'BASIC',
  STANDARD = 'STANDARD',
  HIGH = 'HIGH',
  MAXIMUM = 'MAXIMUM',
  SPECIAL = 'SPECIAL'
}

export enum AccessLevel {
  OPEN = 'OPEN',
  RESTRICTED = 'RESTRICTED',
  SECURE = 'SECURE',
  VAULT = 'VAULT',
  CLASSIFIED = 'CLASSIFIED'
}

// Digital Integrity and Cryptography
export interface DigitalFingerprint {
  sha256: string;
  sha1: string;
  md5: string;
  crc32: string;
  customHash?: string;
  
  // Metadata fingerprint
  metadataHash: string;
  
  // Blockchain-style proof
  blockchainProof?: BlockchainProof;
  
  createdAt: Date;
  algorithm: string;
}

export interface IntegrityProof {
  id: string;
  evidenceId: string;
  proofType: ProofType;
  
  // Cryptographic proof
  digitalSignature: DigitalSignature;
  timestampAuthority: TimestampAuthority;
  merkleRoot?: string;
  
  // Physical proof
  sealInfo?: SealInfo;
  photographicProof?: string[];
  
  // Verification
  verificationHistory: VerificationRecord[];
  lastVerified: Date;
  verificationStatus: VerificationStatus;
  
  createdAt: Date;
}

export enum ProofType {
  CRYPTOGRAPHIC = 'CRYPTOGRAPHIC',
  PHYSICAL = 'PHYSICAL',
  PHOTOGRAPHIC = 'PHOTOGRAPHIC',
  WITNESS = 'WITNESS',
  TIMESTAMP = 'TIMESTAMP',
  BLOCKCHAIN = 'BLOCKCHAIN'
}

export interface BlockchainProof {
  blockHash: string;
  transactionHash: string;
  blockNumber: number;
  networkId: string;
  confirmations: number;
  timestamp: Date;
  merkleProof?: string[];
}

export interface DigitalSignature {
  signature: string;
  algorithm: string;
  publicKey: string;
  signedBy: string;
  signedAt: Date;
  purpose: SignaturePurpose;
  certificateChain?: string[];
}

export enum SignaturePurpose {
  CUSTODY_TRANSFER = 'CUSTODY_TRANSFER',
  INTEGRITY_VERIFICATION = 'INTEGRITY_VERIFICATION',
  AUTHENTICATION = 'AUTHENTICATION',
  NON_REPUDIATION = 'NON_REPUDIATION',
  APPROVAL = 'APPROVAL'
}

export interface TimestampAuthority {
  authority: string;
  timestamp: Date;
  token: string;
  certificate: string;
  verified: boolean;
}

export interface SealInfo {
  sealNumber: string;
  sealType: string;
  appliedBy: string;
  appliedAt: Date;
  removedBy?: string;
  removedAt?: Date;
  condition: SealCondition;
  photos: string[];
}

export enum SealCondition {
  INTACT = 'INTACT',
  BROKEN = 'BROKEN',
  TAMPERED = 'TAMPERED',
  MISSING = 'MISSING'
}

export interface TamperCheck {
  id: string;
  evidenceId: string;
  checkType: TamperCheckType;
  checkedBy: string;
  checkedAt: Date;
  
  // Results
  tamperDetected: boolean;
  tamperIndicators: TamperIndicator[];
  integrityScore: number; // 0-100
  
  // Details
  checkMethod: string;
  tools: string[];
  photos?: string[];
  notes: string;
  
  // Follow-up
  actionTaken?: string;
  reportGenerated: boolean;
  investigationId?: string;
}

export enum TamperCheckType {
  ROUTINE = 'ROUTINE',
  TRIGGERED = 'TRIGGERED',
  COURT_ORDERED = 'COURT_ORDERED',
  INTEGRITY_VERIFICATION = 'INTEGRITY_VERIFICATION',
  INCIDENT_RESPONSE = 'INCIDENT_RESPONSE'
}

export interface TamperIndicator {
  type: IndicatorType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  evidence?: string;
  confidence: number; // 0-100
}

export enum IndicatorType {
  HASH_MISMATCH = 'HASH_MISMATCH',
  TIMESTAMP_ANOMALY = 'TIMESTAMP_ANOMALY',
  SEAL_BREACH = 'SEAL_BREACH',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  FILE_MODIFICATION = 'FILE_MODIFICATION',
  METADATA_CHANGE = 'METADATA_CHANGE',
  SIGNATURE_INVALID = 'SIGNATURE_INVALID',
  PHYSICAL_DAMAGE = 'PHYSICAL_DAMAGE',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY'
}

export interface VerificationRecord {
  id: string;
  verifiedBy: string;
  verifiedAt: Date;
  verificationMethod: string;
  result: VerificationResult;
  confidence: number;
  notes?: string;
  tools?: string[];
}

export enum VerificationResult {
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
  INCONCLUSIVE = 'INCONCLUSIVE',
  REQUIRES_INVESTIGATION = 'REQUIRES_INVESTIGATION'
}

export enum VerificationStatus {
  VALID = 'VALID',
  INVALID = 'INVALID',
  EXPIRED = 'EXPIRED',
  PENDING = 'PENDING',
  COMPROMISED = 'COMPROMISED'
}

// Legal and Compliance
export interface PreservationOrder {
  id: string;
  orderNumber: string;
  issuedBy: string;
  issuedAt: Date;
  expiresAt?: Date;
  
  scope: PreservationScope;
  requirements: PreservationRequirement[];
  
  jurisdiction: string;
  courtCase?: string;
  legalAuthority: string;
  
  status: PreservationStatus;
  complianceChecks: ComplianceCheck[];
}

export interface PreservationScope {
  timeRange?: {
    from: Date;
    to: Date;
  };
  evidenceTypes: EvidenceType[];
  categories: EvidenceCategory[];
  keywords: string[];
  custodians: string[];
  locations: string[];
}

export interface PreservationRequirement {
  type: RequirementType;
  description: string;
  mandatory: boolean;
  deadline?: Date;
  status: RequirementStatus;
  evidence?: string[];
}

export enum RequirementType {
  COLLECTION = 'COLLECTION',
  PRESERVATION = 'PRESERVATION',
  DOCUMENTATION = 'DOCUMENTATION',
  ACCESS_CONTROL = 'ACCESS_CONTROL',
  NOTIFICATION = 'NOTIFICATION',
  REPORTING = 'REPORTING',
  DESTRUCTION_SUSPENSION = 'DESTRUCTION_SUSPENSION'
}

export enum RequirementStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
  NOT_APPLICABLE = 'NOT_APPLICABLE'
}

export enum PreservationStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
  SUSPENDED = 'SUSPENDED',
  MODIFIED = 'MODIFIED'
}

export interface ComplianceCheck {
  id: string;
  checkType: ComplianceCheckType;
  performedBy: string;
  performedAt: Date;
  
  scope: string[];
  standards: ComplianceStandard[];
  
  result: ComplianceResult;
  findings: ComplianceFinding[];
  score: number; // 0-100
  
  recommendations: string[];
  actionItems: ComplianceAction[];
  
  nextCheckDue?: Date;
  notes?: string;
}

export enum ComplianceCheckType {
  ROUTINE_AUDIT = 'ROUTINE_AUDIT',
  COURT_ORDERED = 'COURT_ORDERED',
  INCIDENT_TRIGGERED = 'INCIDENT_TRIGGERED',
  PRE_TRIAL = 'PRE_TRIAL',
  REGULATORY = 'REGULATORY'
}

export interface ComplianceStandard {
  name: string;
  version: string;
  authority: string;
  requirements: string[];
  jurisdiction?: string;
}

export enum ComplianceResult {
  COMPLIANT = 'COMPLIANT',
  NON_COMPLIANT = 'NON_COMPLIANT',
  PARTIALLY_COMPLIANT = 'PARTIALLY_COMPLIANT',
  UNDER_REVIEW = 'UNDER_REVIEW'
}

export interface ComplianceFinding {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  description: string;
  standard: string;
  requirement: string;
  evidence?: string[];
  remediation: string;
  deadline?: Date;
}

export interface ComplianceAction {
  id: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assignedTo: string;
  dueDate: Date;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
  evidence?: string[];
  notes?: string;
}

// Anonymization and Witness Protection
export interface AnonymizedWitnessInfo {
  witnessId: string; // Anonymized ID
  protectionLevel: ProtectionLevel;
  contactMethod: ContactMethod;
  credibilityScore?: number;
  riskAssessment: RiskAssessment;
  anonymizationMethod: AnonymizationMethod[];
}

export enum ProtectionLevel {
  NONE = 'NONE',
  BASIC = 'BASIC',
  ENHANCED = 'ENHANCED',
  WITNESS_PROTECTION = 'WITNESS_PROTECTION',
  MAXIMUM = 'MAXIMUM'
}

export enum ContactMethod {
  DIRECT = 'DIRECT',
  THROUGH_ATTORNEY = 'THROUGH_ATTORNEY',
  COURT_ONLY = 'COURT_ONLY',
  NO_CONTACT = 'NO_CONTACT',
  SPECIAL_ARRANGEMENT = 'SPECIAL_ARRANGEMENT'
}

export interface RiskAssessment {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  factors: RiskFactor[];
  mitigation: MitigationMeasure[];
  reviewDate: Date;
  assessedBy: string;
}

export interface RiskFactor {
  type: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  probability: number; // 0-100
}

export interface MitigationMeasure {
  type: string;
  description: string;
  implemented: boolean;
  implementedAt?: Date;
  effectiveness?: number; // 0-100
}

export interface AnonymizationMethod {
  technique: AnonymizationTechnique;
  applied: boolean;
  strength: AnonymizationStrength;
  reversible: boolean;
  key?: string; // Encrypted key for reversible anonymization
}

export enum AnonymizationTechnique {
  PSEUDONYMIZATION = 'PSEUDONYMIZATION',
  GENERALIZATION = 'GENERALIZATION',
  SUPPRESSION = 'SUPPRESSION',
  RANDOMIZATION = 'RANDOMIZATION',
  ENCRYPTION = 'ENCRYPTION',
  MASKING = 'MASKING',
  SYNTHETIC = 'SYNTHETIC'
}

export enum AnonymizationStrength {
  WEAK = 'WEAK',
  MEDIUM = 'MEDIUM',
  STRONG = 'STRONG',
  PERFECT = 'PERFECT'
}

export interface SourceProtection {
  protectionRequired: boolean;
  protectionType: ProtectionType[];
  restrictions: SourceRestriction[];
  authorizedPersonnel: string[];
  reviewDate: Date;
  notes?: string;
}

export enum ProtectionType {
  IDENTITY_PROTECTION = 'IDENTITY_PROTECTION',
  LOCATION_PROTECTION = 'LOCATION_PROTECTION',
  METHOD_PROTECTION = 'METHOD_PROTECTION',
  TIMING_PROTECTION = 'TIMING_PROTECTION',
  RELATIONSHIP_PROTECTION = 'RELATIONSHIP_PROTECTION'
}

export interface SourceRestriction {
  type: RestrictionType;
  description: string;
  scope: string[];
  exceptions?: string[];
  authority: string;
  expiresAt?: Date;
}

export enum RestrictionType {
  ACCESS = 'ACCESS',
  DISCLOSURE = 'DISCLOSURE',
  PUBLICATION = 'PUBLICATION',
  SHARING = 'SHARING',
  COPYING = 'COPYING',
  ANALYSIS = 'ANALYSIS'
}

// Evidence Relationships and Timeline
export interface EvidenceRelationship {
  id: string;
  sourceEvidenceId: string;
  targetEvidenceId: string;
  relationshipType: RelationshipType;
  strength: RelationshipStrength;
  confidence: number; // 0-100
  
  description: string;
  establishedBy: string;
  establishedAt: Date;
  method: string;
  
  evidence: RelationshipEvidence[];
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  
  tags: string[];
  notes?: string;
}

export enum RelationshipType {
  PARENT_CHILD = 'PARENT_CHILD',
  SIBLING = 'SIBLING',
  DERIVED_FROM = 'DERIVED_FROM',
  COPY_OF = 'COPY_OF',
  RELATED_TO = 'RELATED_TO',
  CONTRADICTS = 'CONTRADICTS',
  SUPPORTS = 'SUPPORTS',
  TEMPORAL_SEQUENCE = 'TEMPORAL_SEQUENCE',
  CAUSAL = 'CAUSAL',
  CONTEXTUAL = 'CONTEXTUAL'
}

export enum RelationshipStrength {
  WEAK = 'WEAK',
  MODERATE = 'MODERATE',
  STRONG = 'STRONG',
  DEFINITIVE = 'DEFINITIVE'
}

export interface RelationshipEvidence {
  type: string;
  description: string;
  source: string;
  confidence: number;
}

export interface EvidenceTimeline {
  id: string;
  caseId: string;
  title: string;
  description?: string;
  
  events: TimelineEvent[];
  periods: TimelinePeriod[];
  
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  
  visualization: TimelineVisualization;
  filters: TimelineFilter[];
}

export interface TimelineEvent {
  id: string;
  evidenceId: string;
  eventType: EventType;
  timestamp: Date;
  duration?: number; // minutes
  
  title: string;
  description: string;
  location?: string;
  
  participants: EventParticipant[];
  certainty: EventCertainty;
  
  sources: string[]; // Evidence IDs
  tags: string[];
}

export enum EventType {
  COLLECTION = 'COLLECTION',
  CREATION = 'CREATION',
  MODIFICATION = 'MODIFICATION',
  ACCESS = 'ACCESS',
  TRANSFER = 'TRANSFER',
  ANALYSIS = 'ANALYSIS',
  INCIDENT = 'INCIDENT',
  COMMUNICATION = 'COMMUNICATION',
  TRANSACTION = 'TRANSACTION',
  MEETING = 'MEETING',
  OTHER = 'OTHER'
}

export interface EventParticipant {
  id: string;
  role: ParticipantRole;
  anonymized: boolean;
  notes?: string;
}

export enum ParticipantRole {
  CREATOR = 'CREATOR',
  RECIPIENT = 'RECIPIENT',
  WITNESS = 'WITNESS',
  ANALYST = 'ANALYST',
  CUSTODIAN = 'CUSTODIAN',
  INVESTIGATOR = 'INVESTIGATOR',
  SUBJECT = 'SUBJECT',
  OTHER = 'OTHER'
}

export enum EventCertainty {
  CONFIRMED = 'CONFIRMED',
  PROBABLE = 'PROBABLE',
  POSSIBLE = 'POSSIBLE',
  SPECULATIVE = 'SPECULATIVE'
}

export interface TimelinePeriod {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  description: string;
  color: string;
  evidenceIds: string[];
}

export interface TimelineVisualization {
  type: VisualizationType;
  settings: VisualizationSettings;
  filters: string[];
  grouping?: string;
  sorting: TimelineSorting;
}

export enum VisualizationType {
  CHRONOLOGICAL = 'CHRONOLOGICAL',
  GANTT = 'GANTT',
  NETWORK = 'NETWORK',
  HEATMAP = 'HEATMAP',
  FLOWCHART = 'FLOWCHART'
}

export interface VisualizationSettings {
  showRelationships: boolean;
  showUncertain: boolean;
  showAnonymized: boolean;
  colorScheme: string;
  timeScale: TimeScale;
  aggregationLevel: AggregationLevel;
}

export enum TimeScale {
  SECOND = 'SECOND',
  MINUTE = 'MINUTE',
  HOUR = 'HOUR',
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  YEAR = 'YEAR'
}

export enum AggregationLevel {
  NONE = 'NONE',
  HOUR = 'HOUR',
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH'
}

export interface TimelineFilter {
  field: string;
  operator: FilterOperator;
  value: any;
  active: boolean;
}

export enum FilterOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  CONTAINS = 'CONTAINS',
  STARTS_WITH = 'STARTS_WITH',
  ENDS_WITH = 'ENDS_WITH',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  BETWEEN = 'BETWEEN',
  IN = 'IN',
  NOT_IN = 'NOT_IN'
}

export interface TimelineSorting {
  field: string;
  direction: 'ASC' | 'DESC';
  secondary?: {
    field: string;
    direction: 'ASC' | 'DESC';
  };
}

// Evidence Lifecycle
export interface EvidenceLifecycle {
  id: string;
  evidenceId: string;
  stage: LifecycleStage;
  status: LifecycleStatus;
  
  enteredAt: Date;
  enteredBy: string;
  exitedAt?: Date;
  exitedBy?: string;
  
  activities: LifecycleActivity[];
  requirements: LifecycleRequirement[];
  
  nextStage?: LifecycleStage;
  scheduledTransition?: Date;
  
  notes?: string;
}

export enum LifecycleStage {
  IDENTIFICATION = 'IDENTIFICATION',
  COLLECTION = 'COLLECTION',
  PRESERVATION = 'PRESERVATION',
  ANALYSIS = 'ANALYSIS',
  REVIEW = 'REVIEW',
  PRODUCTION = 'PRODUCTION',
  PRESENTATION = 'PRESENTATION',
  RETURN = 'RETURN',
  DISPOSAL = 'DISPOSAL'
}

export enum LifecycleStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ON_HOLD = 'ON_HOLD',
  ESCALATED = 'ESCALATED',
  CANCELLED = 'CANCELLED'
}

export interface LifecycleActivity {
  id: string;
  type: ActivityType;
  description: string;
  performedBy: string;
  performedAt: Date;
  duration?: number;
  status: ActivityStatus;
  results?: string;
}

export enum ActivityStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED'
}

export interface LifecycleRequirement {
  id: string;
  type: string;
  description: string;
  mandatory: boolean;
  deadline?: Date;
  status: RequirementStatus;
  completedBy?: string;
  completedAt?: Date;
  evidence?: string[];
}

// Search and Discovery
export interface EvidenceSearchQuery {
  query: string;
  filters: EvidenceFilter[];
  sort?: EvidenceSort;
  pagination: SearchPagination;
  
  // Advanced options
  includeRelated: boolean;
  includeAnonymized: boolean;
  searchScope: SearchScope[];
  timeRange?: DateRange;
  
  // Legal context
  caseId?: string;
  jurisdiction?: string[];
  legalContext?: string;
}

export interface EvidenceFilter {
  field: string;
  operator: FilterOperator;
  value: any;
  weight?: number; // For relevance scoring
}

export interface EvidenceSort {
  field: string;
  direction: 'ASC' | 'DESC';
  secondary?: EvidenceSort;
}

export interface SearchPagination {
  page: number;
  limit: number;
  offset?: number;
}

export enum SearchScope {
  EVIDENCE = 'EVIDENCE',
  METADATA = 'METADATA',
  CUSTODY_RECORDS = 'CUSTODY_RECORDS',
  ACTIVITIES = 'ACTIVITIES',
  RELATIONSHIPS = 'RELATIONSHIPS',
  TIMELINE = 'TIMELINE',
  COMPLIANCE = 'COMPLIANCE',
  FULL_TEXT = 'FULL_TEXT'
}

export interface DateRange {
  from: Date;
  to: Date;
  inclusive: boolean;
}

export interface EvidenceSearchResult {
  evidence: Evidence[];
  total: number;
  facets: SearchFacet[];
  suggestions: string[];
  
  // Analytics
  searchTime: number;
  relevanceScores: RelevanceScore[];
  
  // Related
  relatedEvidence: Evidence[];
  relatedCases: string[];
  
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface SearchFacet {
  field: string;
  values: FacetValue[];
}

export interface FacetValue {
  value: any;
  count: number;
  selected: boolean;
}

export interface RelevanceScore {
  evidenceId: string;
  score: number;
  factors: ScoreFactor[];
}

export interface ScoreFactor {
  factor: string;
  weight: number;
  contribution: number;
}

// Court Export and Legal Reporting
export interface CourtExport {
  id: string;
  caseId: string;
  exportType: ExportType;
  format: ExportFormat;
  
  // Content
  evidenceIds: string[];
  includeChainOfCustody: boolean;
  includeIntegrityProof: boolean;
  includeTimeline: boolean;
  includeRelationships: boolean;
  
  // Legal requirements
  jurisdiction: string;
  court: string;
  caseNumber: string;
  requestedBy: string;
  authorizedBy: string;
  
  // Certification
  certification: ExportCertification;
  digitalSignature: DigitalSignature;
  
  // Status
  status: ExportStatus;
  createdAt: Date;
  completedAt?: Date;
  downloadUrl?: string;
  expiresAt: Date;
  
  // Audit
  accessLog: ExportAccessLog[];
  notes?: string;
}

export enum ExportType {
  DISCOVERY_PRODUCTION = 'DISCOVERY_PRODUCTION',
  COURT_EXHIBIT = 'COURT_EXHIBIT',
  AUDIT_REPORT = 'AUDIT_REPORT',
  COMPLIANCE_REPORT = 'COMPLIANCE_REPORT',
  CHAIN_OF_CUSTODY = 'CHAIN_OF_CUSTODY',
  INTEGRITY_REPORT = 'INTEGRITY_REPORT',
  TIMELINE_REPORT = 'TIMELINE_REPORT'
}

export enum ExportFormat {
  PDF = 'PDF',
  JSON = 'JSON',
  XML = 'XML',
  CSV = 'CSV',
  TIFF = 'TIFF',
  NATIVE = 'NATIVE',
  LOAD_FILE = 'LOAD_FILE'
}

export interface ExportCertification {
  certifiedBy: string;
  certificationDate: Date;
  certificationText: string;
  standardsCompliance: string[];
  authenticityVerified: boolean;
  completenessVerified: boolean;
  integrityVerified: boolean;
}

export enum ExportStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  DELIVERED = 'DELIVERED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED'
}

export interface ExportAccessLog {
  id: string;
  accessedBy: string;
  accessedAt: Date;
  ipAddress: string;
  userAgent: string;
  action: ExportAction;
  success: boolean;
  notes?: string;
}

export enum ExportAction {
  VIEW = 'VIEW',
  DOWNLOAD = 'DOWNLOAD',
  PRINT = 'PRINT',
  SHARE = 'SHARE',
  MODIFY = 'MODIFY',
  DELETE = 'DELETE'
}

// API Response Types
export interface EvidenceApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  metadata?: {
    timestamp: Date;
    requestId: string;
    version: string;
    compliance: ComplianceInfo;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface ComplianceInfo {
  standardsCompliant: boolean;
  standards: string[];
  jurisdiction: string[];
  lastAudit: Date;
  auditScore: number;
}

// Batch Operations
export interface EvidenceBatchOperation {
  id: string;
  type: EvidenceBatchType;
  evidenceIds: string[];
  parameters: Record<string, any>;
  
  // Status
  status: BatchOperationStatus;
  progress: number; // 0-100
  
  // Results
  successful: string[];
  failed: BatchFailure[];
  
  // Metadata
  requestedBy: string;
  requestedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration?: number;
  
  // Approval (for sensitive operations)
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  
  notes?: string;
}

export enum EvidenceBatchType {
  TRANSFER_CUSTODY = 'TRANSFER_CUSTODY',
  UPDATE_CLASSIFICATION = 'UPDATE_CLASSIFICATION',
  APPLY_LEGAL_HOLD = 'APPLY_LEGAL_HOLD',
  REMOVE_LEGAL_HOLD = 'REMOVE_LEGAL_HOLD',
  ANONYMIZE = 'ANONYMIZE',
  EXPORT = 'EXPORT',
  VERIFY_INTEGRITY = 'VERIFY_INTEGRITY',
  UPDATE_METADATA = 'UPDATE_METADATA',
  SCHEDULE_DESTRUCTION = 'SCHEDULE_DESTRUCTION'
}

export enum BatchOperationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export interface BatchFailure {
  evidenceId: string;
  error: string;
  details?: Record<string, any>;
}

// Case Management Integration
export interface Case {
  id: string;
  caseNumber: string;
  title: string;
  description?: string;
  
  // Legal context
  caseType: CaseType;
  jurisdiction: string[];
  court: string;
  judge?: string;
  
  // Parties
  plaintiff: string;
  defendant: string;
  attorneys: CaseAttorney[];
  
  // Status
  status: CaseStatus;
  phase: CasePhase;
  
  // Evidence
  evidenceIds: string[];
  evidenceCount: number;
  
  // Timeline
  filed: Date;
  trialDate?: Date;
  closedDate?: Date;
  
  // Settings
  preservationNotice: boolean;
  legalHoldActive: boolean;
  discoveryDeadline?: Date;
  
  // Metadata
  tags: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum CaseType {
  CRIMINAL = 'CRIMINAL',
  CIVIL = 'CIVIL',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  REGULATORY = 'REGULATORY',
  INTERNAL = 'INTERNAL'
}

export enum CaseStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  CLOSED = 'CLOSED',
  DISMISSED = 'DISMISSED',
  SETTLED = 'SETTLED',
  ON_HOLD = 'ON_HOLD'
}

export enum CasePhase {
  INVESTIGATION = 'INVESTIGATION',
  DISCOVERY = 'DISCOVERY',
  PRE_TRIAL = 'PRE_TRIAL',
  TRIAL = 'TRIAL',
  POST_TRIAL = 'POST_TRIAL',
  APPEAL = 'APPEAL'
}

export interface CaseAttorney {
  id: string;
  name: string;
  role: AttorneyRole;
  organization: string;
  email: string;
  phone: string;
  barNumber?: string;
  jurisdiction: string[];
}

export enum AttorneyRole {
  LEAD_COUNSEL = 'LEAD_COUNSEL',
  ASSOCIATE = 'ASSOCIATE',
  PROSECUTOR = 'PROSECUTOR',
  DEFENSE = 'DEFENSE',
  PLAINTIFF_COUNSEL = 'PLAINTIFF_COUNSEL',
  DEFENDANT_COUNSEL = 'DEFENDANT_COUNSEL',
  EXPERT = 'EXPERT',
  CONSULTANT = 'CONSULTANT'
}