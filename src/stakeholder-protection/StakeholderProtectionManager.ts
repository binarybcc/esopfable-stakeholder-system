/**
 * Stakeholder Protection Manager
 * Manages stakeholder vulnerability scoring and protection planning
 */

import { EventEmitter } from 'events';

export interface Stakeholder {
  id: string;
  name: string;
  role: 'whistleblower' | 'witness' | 'complainant' | 'investigator' | 'attorney' | 'family_member';
  contactInfo: {
    email: string;
    phone: string;
    emergencyContact: string;
    address?: string;
  };
  riskProfile: {
    exposureLevel: 'high' | 'medium' | 'low';
    vulnerabilityScore: number; // 0-100
    protectionStatus: 'active' | 'enhanced' | 'critical' | 'inactive';
    lastAssessment: Date;
  };
  protectionMeasures: ProtectionMeasure[];
  caseAssociation: string[];
  locationHistory: LocationData[];
  communicationPreferences: {
    secure: boolean;
    channels: string[];
    emergencyOnly: boolean;
  };
  metadata: {
    created: Date;
    lastUpdated: Date;
    tags: string[];
  };
}

export interface ProtectionMeasure {
  id: string;
  type: 'physical' | 'digital' | 'legal' | 'financial' | 'communication';
  description: string;
  status: 'active' | 'pending' | 'completed' | 'suspended';
  priority: 'critical' | 'high' | 'medium' | 'low';
  implementedDate?: Date;
  expiryDate?: Date;
  cost?: number;
  effectiveness: number; // 0-100
  requirements: string[];
  contacts: string[];
}

export interface LocationData {
  timestamp: Date;
  latitude: number;
  longitude: number;
  address: string;
  riskLevel: number;
  safeZone: boolean;
}

export interface VulnerabilityAssessment {
  stakeholderId: string;
  timestamp: Date;
  overallScore: number;
  factors: {
    publicExposure: number;
    caseSignificance: number;
    personalSecurity: number;
    digitalFootprint: number;
    financialStability: number;
    familySafety: number;
    legalProtection: number;
    geographicRisk: number;
  };
  recommendations: string[];
  urgentActions: string[];
}

export class StakeholderProtectionManager extends EventEmitter {
  private stakeholders: Map<string, Stakeholder> = new Map();
  private protectionMeasures: Map<string, ProtectionMeasure> = new Map();
  private assessmentHistory: Map<string, VulnerabilityAssessment[]> = new Map();

  constructor() {
    super();
  }

  /**
   * Add or update stakeholder information
   */
  async addStakeholder(stakeholder: Stakeholder): Promise<void> {
    const existing = this.stakeholders.get(stakeholder.id);
    
    if (existing) {
      // Update existing stakeholder
      const updated = {
        ...existing,
        ...stakeholder,
        metadata: {
          ...existing.metadata,
          lastUpdated: new Date(),
          tags: [...new Set([...existing.metadata.tags, ...stakeholder.metadata.tags])]
        }
      };
      this.stakeholders.set(stakeholder.id, updated);
      this.emit('stakeholder_updated', updated);
    } else {
      // Add new stakeholder
      stakeholder.metadata.created = new Date();
      stakeholder.metadata.lastUpdated = new Date();
      this.stakeholders.set(stakeholder.id, stakeholder);
      this.emit('stakeholder_added', stakeholder);
    }

    // Perform initial vulnerability assessment
    await this.assessVulnerability(stakeholder.id);
  }

  /**
   * Perform comprehensive vulnerability assessment
   */
  async assessVulnerability(stakeholderId: string): Promise<VulnerabilityAssessment> {
    const stakeholder = this.stakeholders.get(stakeholderId);
    if (!stakeholder) {
      throw new Error(`Stakeholder ${stakeholderId} not found`);
    }

    const assessment: VulnerabilityAssessment = {
      stakeholderId,
      timestamp: new Date(),
      overallScore: 0,
      factors: {
        publicExposure: 0,
        caseSignificance: 0,
        personalSecurity: 0,
        digitalFootprint: 0,
        financialStability: 0,
        familySafety: 0,
        legalProtection: 0,
        geographicRisk: 0
      },
      recommendations: [],
      urgentActions: []
    };

    // Assess public exposure risk
    assessment.factors.publicExposure = await this.assessPublicExposure(stakeholder);
    
    // Assess case significance
    assessment.factors.caseSignificance = await this.assessCaseSignificance(stakeholder);
    
    // Assess personal security
    assessment.factors.personalSecurity = await this.assessPersonalSecurity(stakeholder);
    
    // Assess digital footprint
    assessment.factors.digitalFootprint = await this.assessDigitalFootprint(stakeholder);
    
    // Assess financial stability
    assessment.factors.financialStability = await this.assessFinancialStability(stakeholder);
    
    // Assess family safety
    assessment.factors.familySafety = await this.assessFamilySafety(stakeholder);
    
    // Assess legal protection
    assessment.factors.legalProtection = await this.assessLegalProtection(stakeholder);
    
    // Assess geographic risk
    assessment.factors.geographicRisk = await this.assessGeographicRisk(stakeholder);

    // Calculate overall score
    const factorValues = Object.values(assessment.factors);
    assessment.overallScore = factorValues.reduce((sum, val) => sum + val, 0) / factorValues.length;

    // Generate recommendations and urgent actions
    assessment.recommendations = this.generateRecommendations(assessment);
    assessment.urgentActions = this.generateUrgentActions(assessment);

    // Store assessment
    const history = this.assessmentHistory.get(stakeholderId) || [];
    history.push(assessment);
    this.assessmentHistory.set(stakeholderId, history);

    // Update stakeholder risk profile
    stakeholder.riskProfile.vulnerabilityScore = assessment.overallScore;
    stakeholder.riskProfile.lastAssessment = new Date();
    stakeholder.riskProfile.protectionStatus = this.determineProtectionStatus(assessment.overallScore);

    this.emit('vulnerability_changed', stakeholderId);
    
    return assessment;
  }

  /**
   * Create and implement protection measures
   */
  async createProtectionPlan(stakeholderId: string, assessment: VulnerabilityAssessment): Promise<ProtectionMeasure[]> {
    const measures: ProtectionMeasure[] = [];
    
    // Physical protection measures
    if (assessment.factors.personalSecurity > 60 || assessment.factors.geographicRisk > 60) {
      measures.push({
        id: `physical_${stakeholderId}_${Date.now()}`,
        type: 'physical',
        description: 'Enhanced personal security and safe house arrangements',
        status: 'pending',
        priority: 'critical',
        effectiveness: 85,
        requirements: ['Security detail', 'Safe house', 'Transportation'],
        contacts: ['security_team', 'law_enforcement']
      });
    }

    // Digital protection measures
    if (assessment.factors.digitalFootprint > 50) {
      measures.push({
        id: `digital_${stakeholderId}_${Date.now()}`,
        type: 'digital',
        description: 'Digital security enhancement and monitoring',
        status: 'pending',
        priority: 'high',
        effectiveness: 75,
        requirements: ['VPN setup', 'Secure communications', 'Device hardening'],
        contacts: ['cybersecurity_team']
      });
    }

    // Legal protection measures
    if (assessment.factors.legalProtection < 40) {
      measures.push({
        id: `legal_${stakeholderId}_${Date.now()}`,
        type: 'legal',
        description: 'Legal protection and representation enhancement',
        status: 'pending',
        priority: 'high',
        effectiveness: 80,
        requirements: ['Legal counsel', 'Protection order', 'Witness protection'],
        contacts: ['legal_team', 'prosecutors_office']
      });
    }

    // Financial protection measures
    if (assessment.factors.financialStability > 60) {
      measures.push({
        id: `financial_${stakeholderId}_${Date.now()}`,
        type: 'financial',
        description: 'Financial security and monitoring',
        status: 'pending',
        priority: 'medium',
        effectiveness: 70,
        requirements: ['Account monitoring', 'Credit protection', 'Emergency funds'],
        contacts: ['financial_advisor', 'bank_security']
      });
    }

    // Communication protection measures
    measures.push({
      id: `comm_${stakeholderId}_${Date.now()}`,
      type: 'communication',
      description: 'Secure communication channels and protocols',
      status: 'pending',
      priority: 'high',
      effectiveness: 90,
      requirements: ['Encrypted messaging', 'Secure phones', 'Communication protocols'],
      contacts: ['communications_team']
    });

    // Store and implement measures
    for (const measure of measures) {
      this.protectionMeasures.set(measure.id, measure);
      await this.implementProtectionMeasure(measure.id);
    }

    // Update stakeholder protection measures
    const stakeholder = this.stakeholders.get(stakeholderId);
    if (stakeholder) {
      stakeholder.protectionMeasures = measures;
      this.emit('protection_plan_created', { stakeholderId, measures });
    }

    return measures;
  }

  /**
   * Monitor location and assess geographic risk
   */
  async trackLocation(stakeholderId: string, location: Omit<LocationData, 'riskLevel' | 'safeZone'>): Promise<void> {
    const stakeholder = this.stakeholders.get(stakeholderId);
    if (!stakeholder) return;

    // Assess location risk
    const riskLevel = await this.assessLocationRisk(location);
    const safeZone = riskLevel < 30;

    const locationData: LocationData = {
      ...location,
      riskLevel,
      safeZone
    };

    // Add to location history
    stakeholder.locationHistory.push(locationData);
    
    // Keep only last 100 locations
    if (stakeholder.locationHistory.length > 100) {
      stakeholder.locationHistory = stakeholder.locationHistory.slice(-100);
    }

    // Alert if in high-risk area
    if (riskLevel > 70) {
      this.emit('high_risk_location', {
        stakeholderId,
        location: locationData,
        riskLevel
      });
    }

    this.emit('location_updated', { stakeholderId, location: locationData });
  }

  /**
   * Get stakeholder protection status
   */
  async getProtectionStatus(stakeholderId: string): Promise<any> {
    const stakeholder = this.stakeholders.get(stakeholderId);
    if (!stakeholder) return null;

    const activeMeasures = stakeholder.protectionMeasures.filter(m => m.status === 'active');
    const latestAssessment = this.assessmentHistory.get(stakeholderId)?.slice(-1)[0];

    return {
      stakeholder: {
        id: stakeholder.id,
        name: stakeholder.name,
        role: stakeholder.role,
        riskProfile: stakeholder.riskProfile
      },
      activeMeasures,
      latestAssessment,
      locationStatus: this.getLocationStatus(stakeholder),
      communicationStatus: this.getCommunicationStatus(stakeholder)
    };
  }

  // Private assessment methods
  private async assessPublicExposure(stakeholder: Stakeholder): Promise<number> {
    let score = 0;
    
    // Higher score for whistleblowers and witnesses
    if (stakeholder.role === 'whistleblower') score += 80;
    else if (stakeholder.role === 'witness') score += 60;
    else if (stakeholder.role === 'complainant') score += 40;
    
    // Check media mentions (placeholder)
    const mediaMentions = await this.checkMediaMentions(stakeholder.id);
    score += Math.min(20, mediaMentions * 2);
    
    return Math.min(100, score);
  }

  private async assessCaseSignificance(stakeholder: Stakeholder): Promise<number> {
    let score = 0;
    
    // Score based on number of associated cases
    score += Math.min(50, stakeholder.caseAssociation.length * 10);
    
    // Check case profiles and significance (placeholder)
    for (const caseId of stakeholder.caseAssociation) {
      const caseSignificance = await this.getCaseSignificance(caseId);
      score += caseSignificance;
    }
    
    return Math.min(100, score / stakeholder.caseAssociation.length);
  }

  private async assessPersonalSecurity(stakeholder: Stakeholder): Promise<number> {
    let score = 40; // Base score
    
    // Check for existing protection measures
    const physicalMeasures = stakeholder.protectionMeasures.filter(m => 
      m.type === 'physical' && m.status === 'active'
    );
    
    score -= physicalMeasures.length * 10;
    
    // Check recent threats
    const recentThreats = await this.getRecentThreats(stakeholder.id);
    score += Math.min(60, recentThreats.length * 15);
    
    return Math.max(0, Math.min(100, score));
  }

  private async assessDigitalFootprint(stakeholder: Stakeholder): Promise<number> {
    let score = 30; // Base digital exposure
    
    // Check social media presence (placeholder)
    const socialMediaAccounts = await this.checkSocialMediaAccounts(stakeholder.id);
    score += socialMediaAccounts.length * 5;
    
    // Check public records (placeholder)
    const publicRecords = await this.checkPublicRecords(stakeholder.id);
    score += Math.min(30, publicRecords * 3);
    
    return Math.min(100, score);
  }

  private async assessFinancialStability(stakeholder: Stakeholder): Promise<number> {
    let score = 20; // Base risk
    
    // Check for financial pressure indicators (placeholder)
    const financialAlerts = await this.checkFinancialAlerts(stakeholder.id);
    score += financialAlerts.length * 10;
    
    // Job loss or employment issues
    const employmentRisk = await this.checkEmploymentRisk(stakeholder.id);
    score += employmentRisk;
    
    return Math.min(100, score);
  }

  private async assessFamilySafety(stakeholder: Stakeholder): Promise<number> {
    let score = 10; // Base risk
    
    // Check for family members involved
    const familyMembers = this.getFamilyMembers(stakeholder.id);
    score += familyMembers.length * 15;
    
    // Check for threats against family
    const familyThreats = await this.getFamilyThreats(stakeholder.id);
    score += familyThreats.length * 20;
    
    return Math.min(100, score);
  }

  private async assessLegalProtection(stakeholder: Stakeholder): Promise<number> {
    let score = 80; // Start with good protection
    
    // Check for legal representation
    const hasLegalCounsel = await this.checkLegalCounsel(stakeholder.id);
    if (!hasLegalCounsel) score -= 30;
    
    // Check for protection orders
    const protectionOrders = await this.checkProtectionOrders(stakeholder.id);
    score -= protectionOrders.length * 5; // More protection = less risk
    
    // Check jurisdiction risks
    const jurisdictionRisk = await this.assessJurisdictionRisk(stakeholder);
    score += jurisdictionRisk;
    
    return Math.max(0, Math.min(100, 100 - score)); // Invert so higher = more risk
  }

  private async assessGeographicRisk(stakeholder: Stakeholder): Promise<number> {
    if (!stakeholder.locationHistory.length) return 30; // Default risk
    
    const recentLocation = stakeholder.locationHistory.slice(-1)[0];
    return await this.assessLocationRisk(recentLocation);
  }

  private async assessLocationRisk(location: Omit<LocationData, 'riskLevel' | 'safeZone'>): Promise<number> {
    let risk = 20; // Base risk
    
    // Crime statistics for area (placeholder)
    const crimeRate = await this.getCrimeRate(location.latitude, location.longitude);
    risk += crimeRate;
    
    // Distance from safe zones (placeholder)
    const nearestSafeZone = await this.getNearestSafeZone(location.latitude, location.longitude);
    if (nearestSafeZone > 10) risk += 20; // More than 10 miles from safe zone
    
    // Opposition presence in area (placeholder)
    const oppositionPresence = await this.checkOppositionPresence(location);
    risk += oppositionPresence;
    
    return Math.min(100, risk);
  }

  // Utility methods
  private determineProtectionStatus(vulnerabilityScore: number): 'active' | 'enhanced' | 'critical' | 'inactive' {
    if (vulnerabilityScore >= 80) return 'critical';
    if (vulnerabilityScore >= 60) return 'enhanced';
    if (vulnerabilityScore >= 30) return 'active';
    return 'inactive';
  }

  private generateRecommendations(assessment: VulnerabilityAssessment): string[] {
    const recommendations: string[] = [];
    
    if (assessment.factors.publicExposure > 70) {
      recommendations.push('Implement media training and public relations strategy');
      recommendations.push('Consider temporary relocation or low profile measures');
    }
    
    if (assessment.factors.personalSecurity > 60) {
      recommendations.push('Arrange personal security detail');
      recommendations.push('Install home security system');
      recommendations.push('Vary daily routines and travel routes');
    }
    
    if (assessment.factors.digitalFootprint > 60) {
      recommendations.push('Enhance digital security measures');
      recommendations.push('Limit social media activity');
      recommendations.push('Use secure communication channels only');
    }
    
    if (assessment.factors.legalProtection > 60) {
      recommendations.push('Engage specialized legal counsel');
      recommendations.push('Apply for witness protection if eligible');
      recommendations.push('Document all threats and incidents');
    }
    
    return recommendations;
  }

  private generateUrgentActions(assessment: VulnerabilityAssessment): string[] {
    const urgent: string[] = [];
    
    if (assessment.overallScore > 80) {
      urgent.push('Immediate security assessment required');
      urgent.push('Contact law enforcement');
      urgent.push('Implement emergency protocols');
    }
    
    if (assessment.factors.familySafety > 70) {
      urgent.push('Ensure family member safety');
      urgent.push('Consider family relocation');
    }
    
    if (assessment.factors.personalSecurity > 80) {
      urgent.push('Arrange immediate protection');
      urgent.push('Avoid predictable locations and routines');
    }
    
    return urgent;
  }

  private async implementProtectionMeasure(measureId: string): Promise<void> {
    const measure = this.protectionMeasures.get(measureId);
    if (!measure) return;

    // Implementation logic would go here
    // For now, mark as active
    measure.status = 'active';
    measure.implementedDate = new Date();

    this.emit('protection_measure_implemented', measure);
  }

  // Placeholder methods for external integrations
  private async checkMediaMentions(stakeholderId: string): Promise<number> { return 0; }
  private async getCaseSignificance(caseId: string): Promise<number> { return 50; }
  private async getRecentThreats(stakeholderId: string): Promise<any[]> { return []; }
  private async checkSocialMediaAccounts(stakeholderId: string): Promise<any[]> { return []; }
  private async checkPublicRecords(stakeholderId: string): Promise<number> { return 0; }
  private async checkFinancialAlerts(stakeholderId: string): Promise<any[]> { return []; }
  private async checkEmploymentRisk(stakeholderId: string): Promise<number> { return 0; }
  private async getFamilyMembers(stakeholderId: string): any[] { return []; }
  private async getFamilyThreats(stakeholderId: string): Promise<any[]> { return []; }
  private async checkLegalCounsel(stakeholderId: string): Promise<boolean> { return true; }
  private async checkProtectionOrders(stakeholderId: string): Promise<any[]> { return []; }
  private async assessJurisdictionRisk(stakeholder: Stakeholder): Promise<number> { return 10; }
  private async getCrimeRate(lat: number, lng: number): Promise<number> { return 20; }
  private async getNearestSafeZone(lat: number, lng: number): Promise<number> { return 5; }
  private async checkOppositionPresence(location: any): Promise<number> { return 10; }

  private getLocationStatus(stakeholder: Stakeholder): any {
    const recentLocation = stakeholder.locationHistory.slice(-1)[0];
    return {
      current: recentLocation,
      safeZone: recentLocation?.safeZone || false,
      riskLevel: recentLocation?.riskLevel || 0
    };
  }

  private getCommunicationStatus(stakeholder: Stakeholder): any {
    return {
      secure: stakeholder.communicationPreferences.secure,
      channels: stakeholder.communicationPreferences.channels,
      lastContact: new Date() // Placeholder
    };
  }

  // Public API methods
  public async getAllStakeholders(): Promise<Stakeholder[]> {
    return Array.from(this.stakeholders.values());
  }

  public async getStakeholder(stakeholderId: string): Promise<Stakeholder | null> {
    return this.stakeholders.get(stakeholderId) || null;
  }

  public async getVulnerabilityHistory(stakeholderId: string): Promise<VulnerabilityAssessment[]> {
    return this.assessmentHistory.get(stakeholderId) || [];
  }
}