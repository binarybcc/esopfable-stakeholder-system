import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import logger from './logger';

const execAsync = promisify(exec);

interface ScanResult {
  clean: boolean;
  threats: string[];
  scanTime: number;
  scanner: string;
}

/**
 * Scan file for viruses using ClamAV
 */
export const scanFileForViruses = async (filePath: string): Promise<ScanResult> => {
  const startTime = Date.now();
  
  try {
    // Check if file exists
    await fs.access(filePath);
    
    // Try ClamAV first
    try {
      const clamResult = await scanWithClamAV(filePath);
      return {
        ...clamResult,
        scanTime: Date.now() - startTime,
        scanner: 'clamav'
      };
    } catch (clamError) {
      logger.warn('ClamAV not available, falling back to basic checks', { error: clamError.message });
    }
    
    // Fallback to basic file validation
    const basicResult = await basicFileValidation(filePath);
    return {
      ...basicResult,
      scanTime: Date.now() - startTime,
      scanner: 'basic'
    };
    
  } catch (error) {
    logger.error('Virus scan failed', { filePath, error: error.message });
    throw new Error(`Virus scan failed: ${error.message}`);
  }
};

/**
 * Scan with ClamAV antivirus
 */
const scanWithClamAV = async (filePath: string): Promise<{ clean: boolean; threats: string[] }> => {
  try {
    // Run clamscan command
    const { stdout, stderr } = await execAsync(`clamscan --no-summary "${filePath}"`);
    
    if (stderr) {
      logger.warn('ClamAV scan warning', { stderr, filePath });
    }
    
    // Parse ClamAV output
    const lines = stdout.split('\n').filter(line => line.trim());
    const threats: string[] = [];
    
    for (const line of lines) {
      if (line.includes('FOUND')) {
        const threatMatch = line.match(/: (.+) FOUND/);
        if (threatMatch) {
          threats.push(threatMatch[1]);
        }
      }
    }
    
    return {
      clean: threats.length === 0,
      threats
    };
    
  } catch (error) {
    // ClamAV returns exit code 1 for infected files, 2 for errors
    if (error.code === 1) {
      // File is infected
      const threats = parseClamAVThreats(error.stdout || '');
      return {
        clean: false,
        threats
      };
    }
    
    throw error;
  }
};

/**
 * Parse threats from ClamAV output
 */
const parseClamAVThreats = (output: string): string[] => {
  const threats: string[] = [];
  const lines = output.split('\n');
  
  for (const line of lines) {
    if (line.includes('FOUND')) {
      const threatMatch = line.match(/: (.+) FOUND/);
      if (threatMatch) {
        threats.push(threatMatch[1]);
      }
    }
  }
  
  return threats;
};

/**
 * Basic file validation (fallback when antivirus is not available)
 */
const basicFileValidation = async (filePath: string): Promise<{ clean: boolean; threats: string[] }> => {
  const threats: string[] = [];
  
  try {
    const stats = await fs.stat(filePath);
    const fileContent = await fs.readFile(filePath, 'utf8');
    const fileName = path.basename(filePath).toLowerCase();
    
    // Check file size (reject extremely large files)
    const maxFileSize = 100 * 1024 * 1024; // 100MB
    if (stats.size > maxFileSize) {
      threats.push('FILE_TOO_LARGE');
    }
    
    // Check for suspicious file extensions
    const dangerousExtensions = [
      '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.vbe', 
      '.js', '.jse', '.jar', '.ws', '.wsf', '.wsc', '.wsh', '.ps1',
      '.msi', '.msp', '.dll', '.cpl', '.inf', '.reg'
    ];
    
    const fileExtension = path.extname(fileName);
    if (dangerousExtensions.includes(fileExtension)) {
      threats.push(`SUSPICIOUS_EXTENSION_${fileExtension.toUpperCase()}`);
    }
    
    // Check for embedded scripts or suspicious patterns (basic)
    const suspiciousPatterns = [
      /<script[^>]*>/i,
      /javascript:/i,
      /vbscript:/i,
      /eval\\s*\\(/i,
      /exec\\s*\\(/i,
      /system\\s*\\(/i,
      /\\x00/g, // Null bytes
      /%00/g,   // URL encoded null bytes
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(fileContent)) {
        threats.push(`SUSPICIOUS_CONTENT_${pattern.toString()}`);
      }
    }
    
    // Check for known malware signatures (very basic)
    const malwareSignatures = [
      'EICAR-STANDARD-ANTIVIRUS-TEST-FILE',
      'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
    ];
    
    for (const signature of malwareSignatures) {
      if (fileContent.includes(signature)) {
        threats.push('TEST_MALWARE_SIGNATURE');
      }
    }
    
    return {
      clean: threats.length === 0,
      threats
    };
    
  } catch (error) {
    // If we can't read the file as text, try basic binary checks
    try {
      const buffer = await fs.readFile(filePath);
      
      // Check for null bytes (potential binary exploitation)
      if (buffer.includes(0x00)) {
        // This is normal for binary files, but suspicious for text files
        const textExtensions = ['.txt', '.csv', '.json', '.xml', '.html', '.css', '.js'];
        const fileExtension = path.extname(filePath).toLowerCase();
        
        if (textExtensions.includes(fileExtension)) {
          threats.push('SUSPICIOUS_NULL_BYTES_IN_TEXT_FILE');
        }
      }
      
      return {
        clean: threats.length === 0,
        threats
      };
      
    } catch (binaryError) {
      logger.error('Failed to scan file', { filePath, error: binaryError.message });
      throw new Error('Unable to scan file');
    }
  }
};

/**
 * Batch scan multiple files
 */
export const scanMultipleFiles = async (filePaths: string[]): Promise<Map<string, ScanResult>> => {
  const results = new Map<string, ScanResult>();
  
  // Process files in batches to avoid overwhelming the system
  const batchSize = 5;
  for (let i = 0; i < filePaths.length; i += batchSize) {
    const batch = filePaths.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (filePath) => {
      try {
        const result = await scanFileForViruses(filePath);
        return { filePath, result };
      } catch (error) {
        logger.error('Batch scan failed for file', { filePath, error: error.message });
        return {
          filePath,
          result: {
            clean: false,
            threats: ['SCAN_ERROR'],
            scanTime: 0,
            scanner: 'error'
          }
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    for (const { filePath, result } of batchResults) {
      results.set(filePath, result);
    }
  }
  
  return results;
};

/**
 * Check if ClamAV is available
 */
export const isClamAVAvailable = async (): Promise<boolean> => {
  try {
    await execAsync('clamscan --version');
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Update ClamAV virus definitions
 */
export const updateVirusDefinitions = async (): Promise<void> => {
  try {
    logger.info('Updating virus definitions...');
    await execAsync('freshclam');
    logger.info('Virus definitions updated successfully');
  } catch (error) {
    logger.error('Failed to update virus definitions', { error: error.message });
    throw new Error(`Failed to update virus definitions: ${error.message}`);
  }
};

/**
 * Get scanner status and information
 */
export const getScannerStatus = async (): Promise<{
  clamavAvailable: boolean;
  version?: string;
  lastUpdate?: string;
  signatures?: number;
}> => {
  const status: any = {
    clamavAvailable: false
  };
  
  try {
    // Check ClamAV availability and version
    const { stdout } = await execAsync('clamscan --version');
    status.clamavAvailable = true;
    status.version = stdout.trim().split('\n')[0];
    
    // Get signature count
    try {
      const { stdout: sigOutput } = await execAsync('sigtool --info /var/lib/clamav/main.cvd');
      const sigMatch = sigOutput.match(/Signatures: (\\d+)/);
      if (sigMatch) {
        status.signatures = parseInt(sigMatch[1]);
      }
    } catch (sigError) {
      // Signature info not available
    }
    
    // Get last update time
    try {
      const stats = await fs.stat('/var/lib/clamav/main.cvd');
      status.lastUpdate = stats.mtime.toISOString();
    } catch (updateError) {
      // Update time not available
    }
    
  } catch (error) {
    // ClamAV not available
  }
  
  return status;
};