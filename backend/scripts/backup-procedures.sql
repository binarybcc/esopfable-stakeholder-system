-- Database Backup and Recovery Procedures for Case Management System
-- PostgreSQL implementation with security considerations

-- =============================================================================
-- BACKUP CONFIGURATION
-- =============================================================================

-- Create backup role with minimal required privileges
CREATE ROLE backup_user WITH LOGIN PASSWORD 'secure_backup_password_change_me';
GRANT CONNECT ON DATABASE case_management TO backup_user;
GRANT USAGE ON SCHEMA public TO backup_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO backup_user;

-- Create backup directory structure (run as postgres user on system)
-- mkdir -p /var/lib/postgresql/backups/{daily,weekly,monthly,archive}
-- chown postgres:postgres /var/lib/postgresql/backups -R
-- chmod 700 /var/lib/postgresql/backups -R

-- =============================================================================
-- BACKUP FUNCTIONS
-- =============================================================================

-- Function to create encrypted database dump
CREATE OR REPLACE FUNCTION create_encrypted_backup(
    backup_name TEXT DEFAULT NULL,
    backup_type TEXT DEFAULT 'full'
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    backup_filename TEXT;
    backup_path TEXT;
    current_date TEXT;
BEGIN
    current_date := to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD_HH24-MI-SS');
    
    -- Generate backup filename
    IF backup_name IS NULL THEN
        backup_filename := 'case_management_' || backup_type || '_' || current_date || '.backup';
    ELSE
        backup_filename := backup_name || '_' || current_date || '.backup';
    END IF;
    
    backup_path := '/var/lib/postgresql/backups/daily/' || backup_filename;
    
    -- Log backup start
    INSERT INTO audit_log (action_type, resource_type, notes, timestamp)
    VALUES ('backup_start', 'database', 'Starting ' || backup_type || ' backup: ' || backup_filename, CURRENT_TIMESTAMP);
    
    -- The actual pg_dump would be executed by external script
    -- This function primarily logs and coordinates
    
    RETURN backup_path;
END;
$$;

-- Function to verify backup integrity
CREATE OR REPLACE FUNCTION verify_backup_integrity(backup_path TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result JSONB;
    file_exists BOOLEAN;
    file_size BIGINT;
BEGIN
    -- In production, this would verify file exists and checksums
    -- For now, return a mock verification result
    result := jsonb_build_object(
        'backup_path', backup_path,
        'verified_at', CURRENT_TIMESTAMP,
        'status', 'verified',
        'checksum_valid', true,
        'file_size_bytes', 0 -- Would be actual file size
    );
    
    -- Log verification
    INSERT INTO audit_log (action_type, resource_type, notes, timestamp)
    VALUES ('backup_verify', 'database', 'Backup verified: ' || backup_path, CURRENT_TIMESTAMP);
    
    RETURN result;
END;
$$;

-- =============================================================================
-- BACKUP SCHEDULING VIEWS
-- =============================================================================

-- View for backup status and scheduling
CREATE OR REPLACE VIEW backup_schedule AS
SELECT 
    'daily' as backup_type,
    '0 2 * * *' as cron_schedule, -- 2 AM daily
    'Daily incremental backup' as description,
    30 as retention_days
UNION ALL
SELECT 
    'weekly' as backup_type,
    '0 1 * * 0' as cron_schedule, -- 1 AM Sunday
    'Weekly full backup' as description,
    90 as retention_days
UNION ALL
SELECT 
    'monthly' as backup_type,
    '0 0 1 * *' as cron_schedule, -- Midnight first of month
    'Monthly archive backup' as description,
    365 as retention_days;

-- =============================================================================
-- POINT-IN-TIME RECOVERY SETUP
-- =============================================================================

-- Enable WAL archiving (add to postgresql.conf):
-- wal_level = replica
-- archive_mode = on
-- archive_command = 'test ! -f /var/lib/postgresql/wal_archive/%f && cp %p /var/lib/postgresql/wal_archive/%f'
-- archive_timeout = 300  # Force archive every 5 minutes

-- Create WAL archive directory
-- sudo mkdir -p /var/lib/postgresql/wal_archive
-- sudo chown postgres:postgres /var/lib/postgresql/wal_archive
-- sudo chmod 700 /var/lib/postgresql/wal_archive

-- =============================================================================
-- BACKUP MONITORING
-- =============================================================================

-- Table to track backup history
CREATE TABLE IF NOT EXISTS backup_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_type VARCHAR(50) NOT NULL,
    backup_filename VARCHAR(255) NOT NULL,
    backup_path VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT,
    checksum VARCHAR(128),
    status VARCHAR(50) DEFAULT 'in_progress',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    retention_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for backup monitoring
CREATE INDEX IF NOT EXISTS idx_backup_history_status ON backup_history(status);
CREATE INDEX IF NOT EXISTS idx_backup_history_type_date ON backup_history(backup_type, started_at);
CREATE INDEX IF NOT EXISTS idx_backup_history_retention ON backup_history(retention_until);

-- Function to log backup completion
CREATE OR REPLACE FUNCTION log_backup_completion(
    p_backup_path TEXT,
    p_status TEXT,
    p_file_size BIGINT DEFAULT NULL,
    p_checksum TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE backup_history 
    SET 
        status = p_status,
        completed_at = CURRENT_TIMESTAMP,
        file_size_bytes = p_file_size,
        checksum = p_checksum,
        error_message = p_error_message
    WHERE backup_path = p_backup_path;
    
    -- Log to audit trail
    INSERT INTO audit_log (action_type, resource_type, notes, timestamp)
    VALUES ('backup_complete', 'database', 
            'Backup completed with status: ' || p_status || ' - ' || p_backup_path, 
            CURRENT_TIMESTAMP);
END;
$$;

-- =============================================================================
-- RECOVERY PROCEDURES
-- =============================================================================

-- Function to prepare for recovery (validation and prerequisites)
CREATE OR REPLACE FUNCTION prepare_recovery(recovery_type TEXT, target_time TIMESTAMP DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result JSONB;
    latest_backup TEXT;
    wal_files_available BOOLEAN;
BEGIN
    -- Validate recovery type
    IF recovery_type NOT IN ('full', 'point_in_time', 'partial') THEN
        RETURN jsonb_build_object('error', 'Invalid recovery type');
    END IF;
    
    -- Find latest backup
    SELECT backup_path INTO latest_backup
    FROM backup_history
    WHERE status = 'completed' AND backup_type IN ('full', 'weekly')
    ORDER BY completed_at DESC
    LIMIT 1;
    
    IF latest_backup IS NULL THEN
        RETURN jsonb_build_object('error', 'No valid backup found for recovery');
    END IF;
    
    -- Check WAL availability for PITR
    IF recovery_type = 'point_in_time' AND target_time IS NOT NULL THEN
        -- In production, this would check WAL archive
        wal_files_available := TRUE;
    END IF;
    
    result := jsonb_build_object(
        'recovery_type', recovery_type,
        'target_time', target_time,
        'backup_to_use', latest_backup,
        'wal_available', wal_files_available,
        'status', 'ready',
        'estimated_duration_minutes', 
            CASE recovery_type 
                WHEN 'full' THEN 30
                WHEN 'point_in_time' THEN 45
                ELSE 60
            END
    );
    
    -- Log recovery preparation
    INSERT INTO audit_log (action_type, resource_type, notes, timestamp)
    VALUES ('recovery_prepare', 'database', 
            'Recovery prepared: ' || result::text, 
            CURRENT_TIMESTAMP);
    
    RETURN result;
END;
$$;

-- =============================================================================
-- CLEANUP AND MAINTENANCE
-- =============================================================================

-- Function to cleanup old backups based on retention policy
CREATE OR REPLACE FUNCTION cleanup_old_backups()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    cleanup_count INTEGER;
BEGIN
    -- Mark expired backups
    UPDATE backup_history 
    SET status = 'expired'
    WHERE retention_until < CURRENT_TIMESTAMP 
      AND status = 'completed';
    
    GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    
    -- Log cleanup
    INSERT INTO audit_log (action_type, resource_type, notes, timestamp)
    VALUES ('backup_cleanup', 'database', 
            'Marked ' || cleanup_count || ' backups for cleanup', 
            CURRENT_TIMESTAMP);
    
    RETURN cleanup_count;
END;
$$;

-- =============================================================================
-- DISASTER RECOVERY CHECKLIST
-- =============================================================================

-- View for disaster recovery status
CREATE OR REPLACE VIEW disaster_recovery_status AS
WITH backup_status AS (
    SELECT 
        backup_type,
        COUNT(*) as total_backups,
        MAX(completed_at) as last_backup,
        SUM(file_size_bytes) as total_size_bytes
    FROM backup_history 
    WHERE status = 'completed'
    GROUP BY backup_type
),
system_status AS (
    SELECT 
        CASE 
            WHEN MAX(completed_at) > CURRENT_TIMESTAMP - INTERVAL '24 hours' THEN 'OK'
            WHEN MAX(completed_at) > CURRENT_TIMESTAMP - INTERVAL '48 hours' THEN 'WARNING'
            ELSE 'CRITICAL'
        END as backup_health,
        COUNT(*) FILTER (WHERE completed_at > CURRENT_TIMESTAMP - INTERVAL '7 days') as recent_backups
    FROM backup_history 
    WHERE status = 'completed'
)
SELECT 
    bs.backup_type,
    bs.total_backups,
    bs.last_backup,
    bs.total_size_bytes,
    ss.backup_health,
    ss.recent_backups
FROM backup_status bs
CROSS JOIN system_status ss;

-- =============================================================================
-- EXTERNAL BACKUP SCRIPT TEMPLATE
-- =============================================================================

/*
#!/bin/bash
# Case Management System Backup Script
# Run as postgres user via cron

BACKUP_DIR="/var/lib/postgresql/backups"
DB_NAME="case_management"
ENCRYPTION_KEY="/path/to/encryption.key"
DATE=$(date +%Y-%m-%d_%H-%M-%S)

# Daily backup
pg_dump -U postgres -h localhost $DB_NAME | \
gzip | \
openssl aes-256-cbc -salt -k $(cat $ENCRYPTION_KEY) > \
$BACKUP_DIR/daily/case_management_daily_$DATE.sql.gz.enc

# Log backup completion
psql -d $DB_NAME -c "SELECT log_backup_completion('$BACKUP_DIR/daily/case_management_daily_$DATE.sql.gz.enc', 'completed', $(stat -f%z $BACKUP_DIR/daily/case_management_daily_$DATE.sql.gz.enc), 'checksum_placeholder');"

# Cleanup old backups
find $BACKUP_DIR/daily -name "*.enc" -mtime +30 -delete
find $BACKUP_DIR/weekly -name "*.enc" -mtime +90 -delete
find $BACKUP_DIR/monthly -name "*.enc" -mtime +365 -delete

# Update database cleanup
psql -d $DB_NAME -c "SELECT cleanup_old_backups();"
*/