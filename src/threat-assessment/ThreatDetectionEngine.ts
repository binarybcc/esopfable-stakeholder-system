/**
 * Threat Detection Engine
 * Advanced threat analysis using pattern recognition and machine learning
 */

import { EventEmitter } from 'events';

export interface ThreatPattern {
  id: string;
  name: string;
  category: 'physical' | 'financial' | 'legal' | 'reputation' | 'evidence' | 'information' | 'personal';
  severity: 'critical' | 'high' | 'medium' | 'low';
  keywords: string[];
  patterns: RegExp[];
  contexts: string[];
  confidence: number;
  falsePositiveRate: number;
  lastUpdated: Date;
}

export interface ThreatIndicator {
  type: 'keyword' | 'pattern' | 'behavior' | 'anomaly' | 'context';
  value: string;
  weight: number;
  source: string;
  timestamp: Date;
}

export interface AnalysisResult {
  threatLevel: number; // 0-1
  confidence: number; // 0-1
  category: string;
  indicators: ThreatIndicator[];
  matchedPatterns: string[];
  recommendations: string[];
  requiresHumanReview: boolean;
}

export interface MLModel {
  name: string;
  type: 'classification' | 'regression' | 'anomaly_detection' | 'nlp';
  accuracy: number;
  lastTrained: Date;
  version: string;
  features: string[];
}

export class ThreatDetectionEngine extends EventEmitter {
  private threatPatterns: Map<string, ThreatPattern> = new Map();
  private mlModels: Map<string, MLModel> = new Map();
  private analysisHistory: any[] = [];
  private keywordCache: Map<string, number> = new Map();

  constructor() {
    super();
    this.initializePatterns();
    this.initializeMLModels();
  }

  /**
   * Initialize threat detection patterns
   */
  private initializePatterns(): void {
    const patterns: ThreatPattern[] = [
      {
        id: 'physical_threat',
        name: 'Physical Threat Detection',
        category: 'physical',
        severity: 'critical',
        keywords: ['kill', 'hurt', 'harm', 'violence', 'attack', 'assault', 'beat', 'shoot', 'stab'],
        patterns: [
          /\b(kill|hurt|harm)\s+(you|them|him|her)\b/i,
          /\b(going to|gonna)\s+(get|hurt|kill)\b/i,
          /\byou('re|\s+are)\s+(dead|finished|done)\b/i
        ],
        contexts: ['threat', 'intimidation', 'violence'],
        confidence: 0.9,
        falsePositiveRate: 0.05,
        lastUpdated: new Date()
      },
      {
        id: 'intimidation',
        name: 'Intimidation Detection',
        category: 'physical',
        severity: 'high',
        keywords: ['watch', 'follow', 'know where', 'find you', 'consequences', 'regret', 'sorry'],
        patterns: [
          /\b(we|i)\s+(know|found)\s+(where|your)\b/i,
          /\byou('ll|\s+will)\s+regret\b/i,
          /\bwatch\s+(your|you)\s+back\b/i
        ],
        contexts: ['intimidation', 'surveillance', 'warning'],
        confidence: 0.8,
        falsePositiveRate: 0.1,
        lastUpdated: new Date()
      },
      {
        id: 'financial_threat',
        name: 'Financial Threat Detection',
        category: 'financial',
        severity: 'high',
        keywords: ['bankrupt', 'ruin', 'destroy', 'career', 'job', 'fired', 'sue', 'lawsuit'],
        patterns: [
          /\b(ruin|destroy)\s+(your|their)\s+(career|life|finances)\b/i,
          /\byou('ll|\s+will)\s+(lose|be fired|get sued)\b/i,
          /\bmake sure you\s+(never work|can't work)\b/i
        ],
        contexts: ['financial pressure', 'career destruction', 'economic warfare'],
        confidence: 0.75,
        falsePositiveRate: 0.15,
        lastUpdated: new Date()
      },
      {
        id: 'legal_harassment',
        name: 'Legal Harassment Detection',
        category: 'legal',
        severity: 'medium',
        keywords: ['lawsuit', 'sue', 'court', 'legal action', 'attorney', 'defamation', 'slander'],
        patterns: [
          /\b(sue|take\s+to\s+court|legal\s+action)\b/i,
          /\bfalse\s+(allegations|accusations|claims)\b/i,
          /\bdefamation\s+(suit|case|claim)\b/i
        ],
        contexts: ['legal intimidation', 'frivolous lawsuits', 'legal warfare'],
        confidence: 0.7,
        falsePositiveRate: 0.2,
        lastUpdated: new Date()
      },
      {
        id: 'reputation_damage',
        name: 'Reputation Damage Detection',
        category: 'reputation',
        severity: 'medium',
        keywords: ['expose', 'reveal', 'dirty', 'secrets', 'scandal', 'discredit', 'smear'],
        patterns: [
          /\b(expose|reveal)\s+(your|their)\s+(secrets|lies)\b/i,
          /\bmake\s+sure\s+(everyone|people)\s+know\b/i,
          /\b(discredit|smear|destroy)\s+(reputation|credibility)\b/i
        ],
        contexts: ['character assassination', 'public humiliation', 'smear campaign'],
        confidence: 0.65,
        falsePositiveRate: 0.25,
        lastUpdated: new Date()
      },
      {
        id: 'evidence_tampering',
        name: 'Evidence Tampering Detection',
        category: 'evidence',
        severity: 'high',
        keywords: ['destroy', 'delete', 'hide', 'evidence', 'documents', 'files', 'records'],
        patterns: [
          /\b(destroy|delete|hide)\s+(evidence|documents|files|records)\b/i,
          /\bmake\s+(it|them)\s+disappear\b/i,
          /\bno\s+one\s+will\s+(find|see|know)\b/i
        ],
        contexts: ['obstruction', 'document destruction', 'evidence suppression'],
        confidence: 0.85,
        falsePositiveRate: 0.1,
        lastUpdated: new Date()
      },
      {
        id: 'information_breach',
        name: 'Information Security Threat',
        category: 'information',
        severity: 'high',
        keywords: ['hack', 'breach', 'access', 'passwords', 'accounts', 'data', 'leak'],
        patterns: [
          /\b(hack|breach|break\s+into)\s+(your|their)\s+(accounts|systems)\b/i,
          /\bget\s+(access|passwords|data)\b/i,
          /\bleak\s+(information|data|files)\b/i
        ],
        contexts: ['cybersecurity threat', 'data breach', 'unauthorized access'],
        confidence: 0.8,
        falsePositiveRate: 0.12,
        lastUpdated: new Date()
      },
      {
        id: 'family_threat',
        name: 'Family Threat Detection',
        category: 'personal',
        severity: 'critical',
        keywords: ['family', 'children', 'kids', 'spouse', 'wife', 'husband', 'parents'],
        patterns: [
          /\b(your|their)\s+(family|children|kids|spouse)\s+(will|are)\b/i,
          /\bknow\s+where\s+(your|their)\s+(family|kids)\s+live\b/i,
          /\b(wife|husband|children)\s+(won't|will)\s+be\s+safe\b/i
        ],
        contexts: ['family intimidation', 'children safety', 'spouse threats'],
        confidence: 0.95,
        falsePositiveRate: 0.03,
        lastUpdated: new Date()
      }
    ];

    patterns.forEach(pattern => {
      this.threatPatterns.set(pattern.id, pattern);
    });
  }

  /**
   * Initialize machine learning models
   */
  private initializeMLModels(): void {
    const models: MLModel[] = [
      {
        name: 'threat_classifier',
        type: 'classification',
        accuracy: 0.87,
        lastTrained: new Date(),
        version: '1.0.0',
        features: ['text_sentiment', 'keyword_density', 'context_analysis', 'linguistic_patterns']
      },
      {
        name: 'severity_predictor',
        type: 'regression',
        accuracy: 0.82,
        lastTrained: new Date(),
        version: '1.0.0',
        features: ['threat_indicators', 'pattern_matches', 'context_severity', 'historical_data']
      },
      {
        name: 'anomaly_detector',
        type: 'anomaly_detection',
        accuracy: 0.79,
        lastTrained: new Date(),
        version: '1.0.0',
        features: ['communication_patterns', 'frequency_analysis', 'timing_patterns', 'sender_behavior']
      },
      {
        name: 'nlp_analyzer',
        type: 'nlp',
        accuracy: 0.85,
        lastTrained: new Date(),
        version: '1.0.0',
        features: ['named_entity_recognition', 'sentiment_analysis', 'intent_classification', 'emotion_detection']
      }
    ];

    models.forEach(model => {
      this.mlModels.set(model.name, model);
    });
  }

  /**
   * Analyze content for threats
   */
  async analyzeThreatLevel(content: string, context?: any): Promise<number> {
    const analysis = await this.performThreatAnalysis(content, context);
    return analysis.threatLevel;
  }

  /**
   * Comprehensive threat analysis
   */
  async performThreatAnalysis(content: string, context?: any): Promise<AnalysisResult> {
    const indicators: ThreatIndicator[] = [];
    const matchedPatterns: string[] = [];
    let maxThreatLevel = 0;
    let totalConfidence = 0;
    let patternMatches = 0;

    // Pattern-based analysis
    for (const [patternId, pattern] of this.threatPatterns) {
      const patternMatch = this.matchPattern(content, pattern);
      
      if (patternMatch.matches) {
        matchedPatterns.push(pattern.name);
        patternMatches++;
        
        const threatLevel = this.calculatePatternThreatLevel(pattern, patternMatch);
        maxThreatLevel = Math.max(maxThreatLevel, threatLevel);
        totalConfidence += pattern.confidence * patternMatch.strength;

        indicators.push({
          type: 'pattern',
          value: pattern.name,
          weight: threatLevel,
          source: 'pattern_matcher',
          timestamp: new Date()
        });
      }
    }

    // Keyword analysis
    const keywordAnalysis = await this.analyzeKeywords(content);
    indicators.push(...keywordAnalysis.indicators);
    maxThreatLevel = Math.max(maxThreatLevel, keywordAnalysis.threatLevel);

    // ML-based analysis
    const mlAnalysis = await this.performMLAnalysis(content, context);
    indicators.push(...mlAnalysis.indicators);
    maxThreatLevel = Math.max(maxThreatLevel, mlAnalysis.threatLevel);

    // Context analysis
    if (context) {
      const contextAnalysis = this.analyzeContext(content, context);
      indicators.push(...contextAnalysis.indicators);
      maxThreatLevel = Math.max(maxThreatLevel, contextAnalysis.threatLevel);
    }

    // Calculate overall confidence
    const overallConfidence = patternMatches > 0 ? 
      totalConfidence / patternMatches : 
      Math.max(keywordAnalysis.confidence, mlAnalysis.confidence);

    // Determine category
    const category = this.determineCategory(matchedPatterns, indicators);

    // Generate recommendations
    const recommendations = this.generateRecommendations(maxThreatLevel, category, indicators);

    const result: AnalysisResult = {
      threatLevel: Math.min(1, maxThreatLevel),
      confidence: Math.min(1, overallConfidence),
      category,
      indicators,
      matchedPatterns,
      recommendations,
      requiresHumanReview: this.requiresHumanReview(maxThreatLevel, overallConfidence, category)
    };

    // Store analysis for learning
    this.analysisHistory.push({
      timestamp: new Date(),
      content: content.substring(0, 100), // Store only first 100 chars for privacy
      result
    });

    // Emit event for high-threat content
    if (maxThreatLevel > 0.6) {
      this.emit('high_threat_detected', result);
    }

    return result;
  }

  /**
   * Pattern matching with strength calculation
   */
  private matchPattern(content: string, pattern: ThreatPattern): { matches: boolean; strength: number } {
    let matches = false;
    let strength = 0;

    // Check keyword matches
    const keywordMatches = pattern.keywords.filter(keyword => 
      content.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    
    if (keywordMatches > 0) {
      matches = true;
      strength += (keywordMatches / pattern.keywords.length) * 0.4;
    }

    // Check regex patterns
    const regexMatches = pattern.patterns.filter(regex => 
      regex.test(content)
    ).length;
    
    if (regexMatches > 0) {
      matches = true;
      strength += (regexMatches / pattern.patterns.length) * 0.6;
    }

    return { matches, strength: Math.min(1, strength) };
  }

  /**
   * Calculate threat level for pattern match
   */
  private calculatePatternThreatLevel(pattern: ThreatPattern, match: { strength: number }): number {
    const severityMultiplier = {
      'critical': 1.0,
      'high': 0.8,
      'medium': 0.6,
      'low': 0.4
    };

    return match.strength * severityMultiplier[pattern.severity] * pattern.confidence;
  }

  /**
   * Keyword-based threat analysis
   */
  private async analyzeKeywords(content: string): Promise<{ threatLevel: number; confidence: number; indicators: ThreatIndicator[] }> {
    const indicators: ThreatIndicator[] = [];
    const words = content.toLowerCase().split(/\s+/);
    let threatScore = 0;

    // High-risk keywords with weights
    const threatKeywords = new Map([
      ['kill', 0.9], ['murder', 0.9], ['death', 0.7],
      ['hurt', 0.6], ['harm', 0.6], ['attack', 0.7],
      ['destroy', 0.5], ['ruin', 0.5], ['revenge', 0.6],
      ['sue', 0.4], ['lawsuit', 0.4], ['court', 0.3],
      ['expose', 0.4], ['reveal', 0.3], ['scandal', 0.4],
      ['hack', 0.6], ['breach', 0.6], ['leak', 0.5]
    ]);

    for (const word of words) {
      const weight = threatKeywords.get(word);
      if (weight) {
        threatScore += weight;
        indicators.push({
          type: 'keyword',
          value: word,
          weight,
          source: 'keyword_analyzer',
          timestamp: new Date()
        });
      }
    }

    // Normalize threat score
    const threatLevel = Math.min(1, threatScore / words.length * 10);
    const confidence = indicators.length > 0 ? 0.7 : 0.1;

    return { threatLevel, confidence, indicators };
  }

  /**
   * Machine learning-based analysis
   */
  private async performMLAnalysis(content: string, context?: any): Promise<{ threatLevel: number; confidence: number; indicators: ThreatIndicator[] }> {
    const indicators: ThreatIndicator[] = [];
    
    // Simulate ML analysis (in real implementation, this would call actual ML models)
    const features = await this.extractFeatures(content, context);
    
    // Threat classification
    const classification = await this.classifyThreat(features);
    indicators.push({
      type: 'pattern',
      value: `ml_classification_${classification.category}`,
      weight: classification.confidence,
      source: 'ml_classifier',
      timestamp: new Date()
    });

    // Severity prediction
    const severity = await this.predictSeverity(features);
    indicators.push({
      type: 'pattern',
      value: `severity_${severity.level}`,
      weight: severity.confidence,
      source: 'severity_predictor',
      timestamp: new Date()
    });

    // Anomaly detection
    const anomaly = await this.detectAnomaly(features);
    if (anomaly.isAnomalous) {
      indicators.push({
        type: 'anomaly',
        value: anomaly.type,
        weight: anomaly.score,
        source: 'anomaly_detector',
        timestamp: new Date()
      });
    }

    // NLP analysis
    const nlp = await this.performNLPAnalysis(content);
    indicators.push(...nlp.indicators);

    const threatLevel = Math.max(classification.threatLevel, severity.threatLevel, anomaly.threatLevel, nlp.threatLevel);
    const confidence = (classification.confidence + severity.confidence + nlp.confidence) / 3;

    return { threatLevel, confidence, indicators };
  }

  /**
   * Context-based analysis
   */
  private analyzeContext(content: string, context: any): { threatLevel: number; indicators: ThreatIndicator[] } {
    const indicators: ThreatIndicator[] = [];
    let threatLevel = 0;

    // Source credibility
    if (context.source) {
      const credibility = this.assessSourceCredibility(context.source);
      threatLevel += credibility.threatMultiplier;
      
      indicators.push({
        type: 'context',
        value: `source_credibility_${credibility.level}`,
        weight: credibility.threatMultiplier,
        source: 'context_analyzer',
        timestamp: new Date()
      });
    }

    // Timing analysis
    if (context.timestamp) {
      const timing = this.analyzeTiming(context.timestamp);
      threatLevel += timing.suspiciousScore;
      
      if (timing.suspicious) {
        indicators.push({
          type: 'behavior',
          value: `suspicious_timing_${timing.pattern}`,
          weight: timing.suspiciousScore,
          source: 'timing_analyzer',
          timestamp: new Date()
        });
      }
    }

    // Communication pattern
    if (context.communicationHistory) {
      const pattern = this.analyzeCommunicationPattern(context.communicationHistory);
      threatLevel += pattern.threatScore;
      
      indicators.push({
        type: 'behavior',
        value: `communication_pattern_${pattern.type}`,
        weight: pattern.threatScore,
        source: 'pattern_analyzer',
        timestamp: new Date()
      });
    }

    return { threatLevel: Math.min(1, threatLevel), indicators };
  }

  /**
   * Determine threat category
   */
  private determineCategory(matchedPatterns: string[], indicators: ThreatIndicator[]): string {
    const categoryScores = new Map<string, number>();

    // Score from matched patterns
    for (const [_, pattern] of this.threatPatterns) {
      if (matchedPatterns.includes(pattern.name)) {
        const currentScore = categoryScores.get(pattern.category) || 0;
        categoryScores.set(pattern.category, currentScore + 1);
      }
    }

    // Score from indicators
    for (const indicator of indicators) {
      if (indicator.value.includes('physical')) {
        const currentScore = categoryScores.get('physical') || 0;
        categoryScores.set('physical', currentScore + indicator.weight);
      }
      // Add more category mappings as needed
    }

    // Find highest scoring category
    let maxCategory = 'general';
    let maxScore = 0;
    
    for (const [category, score] of categoryScores) {
      if (score > maxScore) {
        maxScore = score;
        maxCategory = category;
      }
    }

    return maxCategory;
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(threatLevel: number, category: string, indicators: ThreatIndicator[]): string[] {
    const recommendations: string[] = [];

    if (threatLevel > 0.8) {
      recommendations.push('Immediate security alert required');
      recommendations.push('Contact law enforcement');
      recommendations.push('Implement emergency protocols');
    } else if (threatLevel > 0.6) {
      recommendations.push('Enhanced monitoring required');
      recommendations.push('Notify security team');
      recommendations.push('Increase stakeholder protection level');
    } else if (threatLevel > 0.4) {
      recommendations.push('Continue monitoring');
      recommendations.push('Document incident');
      recommendations.push('Review security measures');
    }

    // Category-specific recommendations
    switch (category) {
      case 'physical':
        recommendations.push('Assess physical security measures');
        recommendations.push('Consider personal protection');
        break;
      case 'financial':
        recommendations.push('Monitor financial accounts');
        recommendations.push('Secure financial information');
        break;
      case 'legal':
        recommendations.push('Consult legal counsel');
        recommendations.push('Prepare legal defense');
        break;
      case 'information':
        recommendations.push('Enhance cybersecurity measures');
        recommendations.push('Review access controls');
        break;
    }

    return recommendations;
  }

  /**
   * Determine if human review is required
   */
  private requiresHumanReview(threatLevel: number, confidence: number, category: string): boolean {
    // High threat level always requires review
    if (threatLevel > 0.7) return true;
    
    // Low confidence requires review
    if (confidence < 0.5) return true;
    
    // Certain categories always require review
    if (['physical', 'family', 'evidence'].includes(category)) return true;
    
    return false;
  }

  // Placeholder methods for ML integration
  private async extractFeatures(content: string, context?: any): Promise<any> {
    return {
      textLength: content.length,
      wordCount: content.split(/\s+/).length,
      sentiment: await this.calculateSentiment(content),
      keywordDensity: this.calculateKeywordDensity(content),
      context: context || {}
    };
  }

  private async classifyThreat(features: any): Promise<any> {
    // Simulate ML classification
    return {
      category: 'general',
      threatLevel: Math.random() * 0.5,
      confidence: 0.7
    };
  }

  private async predictSeverity(features: any): Promise<any> {
    // Simulate severity prediction
    return {
      level: 'medium',
      threatLevel: Math.random() * 0.6,
      confidence: 0.6
    };
  }

  private async detectAnomaly(features: any): Promise<any> {
    // Simulate anomaly detection
    return {
      isAnomalous: Math.random() > 0.8,
      type: 'communication_pattern',
      score: Math.random() * 0.4,
      threatLevel: Math.random() * 0.3
    };
  }

  private async performNLPAnalysis(content: string): Promise<any> {
    // Simulate NLP analysis
    const indicators: ThreatIndicator[] = [{
      type: 'pattern',
      value: 'sentiment_negative',
      weight: 0.3,
      source: 'nlp_analyzer',
      timestamp: new Date()
    }];

    return {
      threatLevel: Math.random() * 0.4,
      confidence: 0.6,
      indicators
    };
  }

  private async calculateSentiment(content: string): Promise<number> {
    // Simple sentiment calculation (negative = higher threat)
    const negativeWords = ['hate', 'angry', 'furious', 'revenge', 'destroy'];
    const words = content.toLowerCase().split(/\s+/);
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;
    return negativeCount / words.length;
  }

  private calculateKeywordDensity(content: string): number {
    const words = content.split(/\s+/);
    const threatKeywords = Array.from(this.threatPatterns.values())
      .flatMap(pattern => pattern.keywords);
    const matches = words.filter(word => 
      threatKeywords.includes(word.toLowerCase())
    ).length;
    return matches / words.length;
  }

  private assessSourceCredibility(source: string): any {
    // Assess source credibility (placeholder)
    return {
      level: 'medium',
      threatMultiplier: 0.1
    };
  }

  private analyzeTiming(timestamp: Date): any {
    // Analyze timing patterns (placeholder)
    const hour = timestamp.getHours();
    const isOffHours = hour < 6 || hour > 22;
    
    return {
      suspicious: isOffHours,
      pattern: isOffHours ? 'off_hours' : 'normal',
      suspiciousScore: isOffHours ? 0.2 : 0
    };
  }

  private analyzeCommunicationPattern(history: any[]): any {
    // Analyze communication patterns (placeholder)
    return {
      type: 'escalating',
      threatScore: 0.15
    };
  }

  // Public API methods
  public async updatePattern(patternId: string, updates: Partial<ThreatPattern>): Promise<void> {
    const pattern = this.threatPatterns.get(patternId);
    if (pattern) {
      const updated = { ...pattern, ...updates, lastUpdated: new Date() };
      this.threatPatterns.set(patternId, updated);
      this.emit('pattern_updated', updated);
    }
  }

  public async addCustomPattern(pattern: ThreatPattern): Promise<void> {
    this.threatPatterns.set(pattern.id, pattern);
    this.emit('pattern_added', pattern);
  }

  public getPatterns(): ThreatPattern[] {
    return Array.from(this.threatPatterns.values());
  }

  public getMLModels(): MLModel[] {
    return Array.from(this.mlModels.values());
  }

  public getAnalysisHistory(): any[] {
    return this.analysisHistory.slice(-100); // Return last 100 analyses
  }
}