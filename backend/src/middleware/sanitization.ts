import { Request, Response, NextFunction } from 'express';
import xss from 'xss';

// XSS sanitization options
const xssOptions = {
  whiteList: {
    // Allow basic text formatting
    b: [],
    i: [],
    strong: [],
    em: [],
    p: [],
    br: [],
    ul: [],
    ol: [],
    li: [],
    // Remove all other HTML tags
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed'],
};

/**
 * Recursively sanitize object properties
 */
const sanitizeObject = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return xss(obj, xssOptions);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key names too
      const sanitizedKey = xss(key, { whiteList: {}, stripIgnoreTag: true });
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
};

/**
 * Sanitize specific fields that should preserve some HTML
 */
const sanitizeRichText = (text: string): string => {
  const richTextOptions = {
    whiteList: {
      p: [],
      br: [],
      strong: [],
      b: [],
      em: [],
      i: [],
      u: [],
      ul: [],
      ol: [],
      li: [],
      h1: [],
      h2: [],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
      blockquote: [],
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed'],
  };
  
  return xss(text, richTextOptions);
};

/**
 * Fields that should preserve rich text formatting
 */
const richTextFields = [
  'description',
  'summary',
  'content',
  'outcome',
  'comment',
  'notes',
  'assessmentNotes',
];

/**
 * Sanitize rich text fields differently
 */
const sanitizeWithRichText = (obj: any, path: string[] = []): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    const currentField = path[path.length - 1];
    if (richTextFields.includes(currentField)) {
      return sanitizeRichText(obj);
    }
    return xss(obj, xssOptions);
  }
  
  if (Array.isArray(obj)) {
    return obj.map((item, index) => 
      sanitizeWithRichText(item, [...path, index.toString()])
    );
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = xss(key, { whiteList: {}, stripIgnoreTag: true });
      sanitized[sanitizedKey] = sanitizeWithRichText(value, [...path, sanitizedKey]);
    }
    return sanitized;
  }
  
  return obj;
};

/**
 * SQL injection prevention - basic pattern detection
 */
const detectSQLInjection = (str: string): boolean => {
  const sqlPatterns = [
    /('|(\\')|(;)|(--)|(\s(or|and)\s+\d+\s*=\s*\d+)|(\s(or|and)\s+\w+\s*=\s*\w+)/i,
    /(union\s+(all\s+)?select)|(select\s+.+\s+from)|(insert\s+into)|(delete\s+from)|(update\s+.+\s+set)/i,
    /(drop\s+(table|database|schema))|(create\s+(table|database|schema))|(alter\s+table)/i,
    /(exec\s*\()|(sp_\w+)|(xp_\w+)/i,
  ];
  
  return sqlPatterns.some(pattern => pattern.test(str));
};

/**
 * Check for potential SQL injection in strings
 */
const validateForSQLInjection = (obj: any): string[] => {
  const violations: string[] = [];
  
  const checkValue = (value: any, path: string) => {
    if (typeof value === 'string' && detectSQLInjection(value)) {
      violations.push(path);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => checkValue(item, `${path}[${index}]`));
    } else if (typeof value === 'object' && value !== null) {
      Object.entries(value).forEach(([key, val]) => 
        checkValue(val, `${path}.${key}`)
      );
    }
  };
  
  if (typeof obj === 'object' && obj !== null) {
    Object.entries(obj).forEach(([key, value]) => 
      checkValue(value, key)
    );
  }
  
  return violations;
};

export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Check for SQL injection attempts
    const sqlViolations = [
      ...validateForSQLInjection(req.body),
      ...validateForSQLInjection(req.query),
      ...validateForSQLInjection(req.params),
    ];
    
    if (sqlViolations.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'SECURITY_VIOLATION',
          message: 'Potential security violation detected',
          details: sqlViolations,
        },
        timestamp: new Date(),
      });
      return;
    }
    
    // Sanitize request body
    if (req.body) {
      req.body = sanitizeWithRichText(req.body);
    }
    
    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    
    // Sanitize URL parameters
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }
    
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SANITIZATION_ERROR',
        message: 'Request sanitization failed',
      },
      timestamp: new Date(),
    });
  }
};