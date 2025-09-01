-- Database Maintenance Scripts for Case Management System
-- Includes performance monitoring, cleanup, and optimization procedures

-- =============================================================================
-- PERFORMANCE MONITORING
-- =============================================================================

-- View for table statistics and performance metrics
CREATE OR REPLACE VIEW table_performance_stats AS
SELECT 
    schemaname,
    tablename,
    attname as column_name,
    n_distinct,
    correlation,
    most_common_vals,
    most_common_freqs
FROM pg_stats 
WHERE schemaname = 'public'
ORDER BY tablename, attname;

-- View for index usage statistics
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'LOW_USAGE'
        WHEN idx_scan < 1000 THEN 'MODERATE_USAGE'
        ELSE 'HIGH_USAGE'
    END as usage_level
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Function to analyze table bloat and recommend maintenance
CREATE OR REPLACE FUNCTION analyze_table_bloat()
RETURNS TABLE (
    table_name TEXT,
    estimated_bloat_pct NUMERIC,
    recommended_action TEXT,
    estimated_time_minutes INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH table_stats AS (
        SELECT 
            t.tablename,
            pg_total_relation_size(t.tablename::regclass) as table_size,
            pg_stat_get_live_tuples(t.tablename::regclass) as live_tuples,
            pg_stat_get_dead_tuples(t.tablename::regclass) as dead_tuples
        FROM pg_tables t
        WHERE t.schemaname = 'public'
    )
    SELECT 
        ts.tablename::TEXT,
        CASE 
            WHEN ts.live_tuples + ts.dead_tuples > 0 
            THEN ROUND((ts.dead_tuples::NUMERIC / (ts.live_tuples + ts.dead_tuples)) * 100, 2)
            ELSE 0
        END as bloat_pct,
        CASE 
            WHEN ts.dead_tuples::NUMERIC / NULLIF(ts.live_tuples + ts.dead_tuples, 0) > 0.2 
            THEN 'VACUUM FULL recommended'
            WHEN ts.dead_tuples::NUMERIC / NULLIF(ts.live_tuples + ts.dead_tuples, 0) > 0.1 
            THEN 'VACUUM recommended'
            ELSE 'No action needed'
        END::TEXT,
        CASE 
            WHEN ts.table_size > 1073741824 THEN 30  -- > 1GB
            WHEN ts.table_size > 104857600 THEN 10   -- > 100MB
            ELSE 5
        END::INTEGER
    FROM table_stats ts
    ORDER BY bloat_pct DESC NULLS LAST;
END;
$$;

-- =============================================================================
-- AUTOMATED MAINTENANCE FUNCTIONS
-- =============================================================================

-- Function to perform routine maintenance
CREATE OR REPLACE FUNCTION perform_routine_maintenance(
    maintenance_type TEXT DEFAULT 'standard',
    force_reindex BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result JSONB;
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    tables_processed INTEGER := 0;
    indexes_rebuilt INTEGER := 0;
BEGIN
    start_time := CURRENT_TIMESTAMP;
    
    -- Log maintenance start
    INSERT INTO audit_log (action_type, resource_type, notes, timestamp)
    VALUES ('maintenance_start', 'database', 
            'Starting ' || maintenance_type || ' maintenance', start_time);
    
    -- Standard maintenance: VACUUM and ANALYZE
    IF maintenance_type IN ('standard', 'full') THEN
        -- VACUUM ANALYZE all tables
        FOR rec IN 
            SELECT tablename FROM pg_tables WHERE schemaname = 'public'
        LOOP
            EXECUTE 'VACUUM ANALYZE ' || quote_ident(rec.tablename);
            tables_processed := tables_processed + 1;
        END LOOP;
    END IF;
    
    -- Full maintenance: additional optimizations
    IF maintenance_type = 'full' OR force_reindex THEN
        -- Reindex tables with high bloat
        FOR rec IN 
            SELECT table_name 
            FROM analyze_table_bloat() 
            WHERE estimated_bloat_pct > 20
        LOOP
            EXECUTE 'REINDEX TABLE ' || quote_ident(rec.table_name);
            indexes_rebuilt := indexes_rebuilt + 1;
        END LOOP;
    END IF;
    
    -- Update table statistics
    ANALYZE;
    
    end_time := CURRENT_TIMESTAMP;
    
    -- Build result
    result := jsonb_build_object(
        'maintenance_type', maintenance_type,
        'start_time', start_time,
        'end_time', end_time,
        'duration_seconds', EXTRACT(EPOCH FROM (end_time - start_time)),
        'tables_processed', tables_processed,
        'indexes_rebuilt', indexes_rebuilt,
        'status', 'completed'
    );
    
    -- Log completion
    INSERT INTO audit_log (action_type, resource_type, notes, timestamp)
    VALUES ('maintenance_complete', 'database', result::text, end_time);
    
    RETURN result;
END;
$$;

-- Function to cleanup old audit logs
CREATE OR REPLACE FUNCTION cleanup_audit_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_log 
    WHERE timestamp < CURRENT_TIMESTAMP - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log cleanup
    INSERT INTO audit_log (action_type, resource_type, notes, timestamp)
    VALUES ('cleanup_audit_logs', 'database', 
            'Deleted ' || deleted_count || ' audit log entries older than ' || retention_days || ' days',
            CURRENT_TIMESTAMP);
    
    RETURN deleted_count;
END;
$$;

-- =============================================================================
-- DATABASE HEALTH MONITORING
-- =============================================================================

-- Function to generate database health report
CREATE OR REPLACE FUNCTION generate_health_report()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    report JSONB;
    db_size BIGINT;
    connection_count INTEGER;
    long_running_queries INTEGER;
    lock_count INTEGER;
BEGIN
    -- Get basic database metrics
    SELECT pg_database_size(current_database()) INTO db_size;
    
    SELECT COUNT(*) INTO connection_count
    FROM pg_stat_activity;
    
    SELECT COUNT(*) INTO long_running_queries
    FROM pg_stat_activity
    WHERE state = 'active' 
      AND query_start < CURRENT_TIMESTAMP - INTERVAL '5 minutes';
    
    SELECT COUNT(*) INTO lock_count
    FROM pg_locks
    WHERE NOT granted;
    
    -- Build comprehensive report
    WITH table_sizes AS (
        SELECT 
            tablename,
            pg_total_relation_size(tablename::regclass) as size_bytes
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY size_bytes DESC
        LIMIT 10
    ),
    slow_queries AS (
        SELECT 
            query,
            state,
            query_start,
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - query_start)) as duration_seconds
        FROM pg_stat_activity
        WHERE state = 'active'
          AND query_start < CURRENT_TIMESTAMP - INTERVAL '30 seconds'
        ORDER BY query_start
        LIMIT 5
    ),
    index_health AS (
        SELECT 
            COUNT(*) as total_indexes,
            COUNT(*) FILTER (WHERE idx_scan = 0) as unused_indexes,
            COUNT(*) FILTER (WHERE idx_scan < 10) as low_usage_indexes
        FROM pg_stat_user_indexes
    )
    SELECT jsonb_build_object(
        'timestamp', CURRENT_TIMESTAMP,
        'database_size_mb', ROUND(db_size / 1024.0 / 1024.0, 2),
        'connections', jsonb_build_object(
            'current', connection_count,
            'max', current_setting('max_connections')::INTEGER
        ),
        'performance', jsonb_build_object(
            'long_running_queries', long_running_queries,
            'lock_waits', lock_count,
            'cache_hit_ratio', 
                ROUND(
                    (SELECT sum(blks_hit) / NULLIF(sum(blks_hit + blks_read), 0) * 100 
                     FROM pg_stat_database 
                     WHERE datname = current_database()), 2
                )
        ),
        'largest_tables', (
            SELECT json_agg(
                json_build_object(
                    'table', tablename,
                    'size_mb', ROUND(size_bytes / 1024.0 / 1024.0, 2)
                )
            )
            FROM table_sizes
        ),
        'slow_queries', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'query', LEFT(query, 100) || '...',
                    'duration_seconds', duration_seconds
                )
            ), '[]'::json)
            FROM slow_queries
        ),
        'indexes', (
            SELECT row_to_json(ih) FROM index_health ih
        ),
        'maintenance_needed', (
            SELECT COUNT(*) > 0 
            FROM analyze_table_bloat() 
            WHERE estimated_bloat_pct > 15
        )
    ) INTO report;
    
    RETURN report;
END;
$$;

-- =============================================================================
-- SECURITY MAINTENANCE
-- =============================================================================

-- Function to audit user permissions and identify potential issues
CREATE OR REPLACE FUNCTION audit_user_permissions()
RETURNS TABLE (
    user_email TEXT,
    permission_type TEXT,
    resource_id UUID,
    expires_at TIMESTAMP,
    risk_level TEXT,
    recommendation TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH permission_analysis AS (
        SELECT 
            u.email,
            up.permission_type,
            up.resource_id,
            up.expires_at,
            CASE 
                -- High risk: Admin permissions without expiration
                WHEN up.permission_type = 'admin_full_access' AND up.expires_at IS NULL THEN 'HIGH'
                -- Medium risk: Secret document access
                WHEN up.permission_type = 'documents_read_secret' THEN 'MEDIUM'
                -- Medium risk: Expired permissions still in system
                WHEN up.expires_at < CURRENT_TIMESTAMP THEN 'MEDIUM'
                -- Low risk: Time-limited permissions
                WHEN up.expires_at IS NOT NULL AND up.expires_at > CURRENT_TIMESTAMP THEN 'LOW'
                ELSE 'STANDARD'
            END as risk,
            CASE 
                WHEN up.permission_type = 'admin_full_access' AND up.expires_at IS NULL 
                THEN 'Consider adding expiration date for admin access'
                WHEN up.expires_at < CURRENT_TIMESTAMP 
                THEN 'Remove expired permission'
                WHEN up.permission_type = 'documents_read_secret' 
                THEN 'Review secret document access regularly'
                ELSE 'No immediate action required'
            END as advice
        FROM users u
        JOIN user_permissions up ON u.id = up.user_id
    )
    SELECT 
        pa.email::TEXT,
        pa.permission_type::TEXT,
        pa.resource_id,
        pa.expires_at,
        pa.risk::TEXT,
        pa.advice::TEXT
    FROM permission_analysis pa
    ORDER BY 
        CASE pa.risk 
            WHEN 'HIGH' THEN 1
            WHEN 'MEDIUM' THEN 2
            WHEN 'LOW' THEN 3
            ELSE 4
        END,
        pa.email;
END;
$$;

-- =============================================================================
-- AUTOMATED MAINTENANCE SCHEDULING
-- =============================================================================

-- Table to track maintenance schedules
CREATE TABLE IF NOT EXISTS maintenance_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maintenance_type VARCHAR(50) NOT NULL,
    frequency_hours INTEGER NOT NULL,
    last_run TIMESTAMP,
    next_run TIMESTAMP,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default maintenance schedules
INSERT INTO maintenance_schedule (maintenance_type, frequency_hours, next_run) VALUES
('routine_vacuum', 24, CURRENT_TIMESTAMP + INTERVAL '1 day'),
('analyze_statistics', 12, CURRENT_TIMESTAMP + INTERVAL '12 hours'),
('cleanup_audit_logs', 168, CURRENT_TIMESTAMP + INTERVAL '7 days'), -- weekly
('health_report', 1, CURRENT_TIMESTAMP + INTERVAL '1 hour'),
('permission_audit', 168, CURRENT_TIMESTAMP + INTERVAL '7 days') -- weekly
ON CONFLICT DO NOTHING;

-- Function to check and run scheduled maintenance
CREATE OR REPLACE FUNCTION run_scheduled_maintenance()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    maintenance_record RECORD;
    result JSONB := '[]'::JSONB;
    task_result JSONB;
BEGIN
    FOR maintenance_record IN 
        SELECT * FROM maintenance_schedule 
        WHERE is_enabled = TRUE 
          AND next_run <= CURRENT_TIMESTAMP
    LOOP
        -- Execute maintenance based on type
        CASE maintenance_record.maintenance_type
            WHEN 'routine_vacuum' THEN
                task_result := perform_routine_maintenance('standard');
            WHEN 'analyze_statistics' THEN
                ANALYZE;
                task_result := jsonb_build_object('status', 'completed', 'task', 'analyze_statistics');
            WHEN 'cleanup_audit_logs' THEN
                task_result := jsonb_build_object(
                    'status', 'completed', 
                    'task', 'cleanup_audit_logs',
                    'deleted_count', cleanup_audit_logs(90)
                );
            WHEN 'health_report' THEN
                task_result := jsonb_build_object(
                    'status', 'completed',
                    'task', 'health_report',
                    'report', generate_health_report()
                );
            WHEN 'permission_audit' THEN
                task_result := jsonb_build_object(
                    'status', 'completed',
                    'task', 'permission_audit',
                    'findings_count', (SELECT COUNT(*) FROM audit_user_permissions() WHERE risk_level IN ('HIGH', 'MEDIUM'))
                );
            ELSE
                task_result := jsonb_build_object('status', 'skipped', 'reason', 'unknown_task_type');
        END CASE;
        
        -- Update schedule
        UPDATE maintenance_schedule 
        SET 
            last_run = CURRENT_TIMESTAMP,
            next_run = CURRENT_TIMESTAMP + (frequency_hours || ' hours')::INTERVAL
        WHERE id = maintenance_record.id;
        
        -- Add to results
        result := result || jsonb_build_object(
            'maintenance_type', maintenance_record.maintenance_type,
            'executed_at', CURRENT_TIMESTAMP,
            'result', task_result
        );
    END LOOP;
    
    RETURN result;
END;
$$;