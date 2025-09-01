/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Stored procedure for stakeholder search with security filtering
  await knex.raw(`
    CREATE OR REPLACE FUNCTION search_stakeholders(
      p_user_id UUID,
      p_search_term TEXT DEFAULT NULL,
      p_category TEXT DEFAULT NULL,
      p_security_level TEXT DEFAULT NULL,
      p_limit INTEGER DEFAULT 50,
      p_offset INTEGER DEFAULT 0
    )
    RETURNS TABLE (
      id UUID,
      category VARCHAR,
      subcategory VARCHAR,
      name VARCHAR,
      organization VARCHAR,
      title VARCHAR,
      security_level security_level_enum,
      created_at TIMESTAMP
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      user_max_security_level TEXT;
    BEGIN
      -- Get user's maximum security clearance
      SELECT CASE 
        WHEN EXISTS(SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND permission_type = 'admin_full_access') THEN 'high'
        WHEN EXISTS(SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND permission_type = 'stakeholders_read_high') THEN 'high'
        WHEN EXISTS(SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND permission_type = 'stakeholders_read_restricted') THEN 'restricted'
        ELSE 'standard'
      END INTO user_max_security_level;
      
      RETURN QUERY
      SELECT s.id, s.category, s.subcategory, s.name, s.organization, s.title, s.security_level, s.created_at
      FROM stakeholders s
      WHERE 
        -- Security level filtering
        (user_max_security_level = 'high' OR 
         (user_max_security_level = 'restricted' AND s.security_level IN ('standard', 'restricted')) OR
         (user_max_security_level = 'standard' AND s.security_level = 'standard'))
        -- Search term filtering
        AND (p_search_term IS NULL OR 
             s.name ILIKE '%' || p_search_term || '%' OR 
             s.organization ILIKE '%' || p_search_term || '%' OR
             s.title ILIKE '%' || p_search_term || '%')
        -- Category filtering
        AND (p_category IS NULL OR s.category = p_category)
        -- Security level filtering (additional)
        AND (p_security_level IS NULL OR s.security_level::TEXT = p_security_level)
      ORDER BY s.name
      LIMIT p_limit
      OFFSET p_offset;
    END;
    $$;
  `);
  
  // Stored procedure for document access with audit logging
  await knex.raw(`
    CREATE OR REPLACE FUNCTION access_document(
      p_document_id UUID,
      p_user_id UUID,
      p_action TEXT,
      p_ip_address INET DEFAULT NULL,
      p_user_agent TEXT DEFAULT NULL
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      doc_classification TEXT;
      user_permissions TEXT[];
      access_granted BOOLEAN := FALSE;
      result JSONB;
    BEGIN
      -- Get document classification
      SELECT classification INTO doc_classification 
      FROM documents 
      WHERE id = p_document_id;
      
      IF doc_classification IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Document not found');
      END IF;
      
      -- Get user permissions
      SELECT array_agg(permission_type) INTO user_permissions
      FROM user_permissions up
      WHERE up.user_id = p_user_id
        AND (up.expires_at IS NULL OR up.expires_at > CURRENT_TIMESTAMP);
      
      -- Check access based on classification and permissions
      CASE doc_classification
        WHEN 'public' THEN
          access_granted := TRUE;
        WHEN 'internal' THEN
          access_granted := 'documents_read_internal' = ANY(user_permissions) OR 
                           'admin_full_access' = ANY(user_permissions);
        WHEN 'confidential' THEN
          access_granted := 'documents_read_confidential' = ANY(user_permissions) OR 
                           'admin_full_access' = ANY(user_permissions);
        WHEN 'secret' THEN
          access_granted := 'documents_read_secret' = ANY(user_permissions) OR 
                           'admin_full_access' = ANY(user_permissions);
      END CASE;
      
      -- Log access attempt
      INSERT INTO document_access_log (document_id, user_id, action, ip_address, user_agent, accessed_at)
      VALUES (p_document_id, p_user_id, p_action::document_access_action, p_ip_address, p_user_agent, CURRENT_TIMESTAMP);
      
      -- Return result
      IF access_granted THEN
        SELECT jsonb_build_object(
          'success', true,
          'document', row_to_json(d)
        ) INTO result
        FROM documents d
        WHERE d.id = p_document_id;
      ELSE
        result := jsonb_build_object('success', false, 'error', 'Access denied');
      END IF;
      
      RETURN result;
    END;
    $$;
  `);
  
  // Stored procedure for evidence chain of custody updates
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_evidence_custody(
      p_evidence_id UUID,
      p_user_id UUID,
      p_action TEXT,
      p_location TEXT DEFAULT NULL,
      p_notes TEXT DEFAULT NULL
    )
    RETURNS BOOLEAN
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      current_custody JSONB;
      new_custody_entry JSONB;
      updated_custody JSONB;
    BEGIN
      -- Check if user has permission to update evidence
      IF NOT EXISTS(
        SELECT 1 FROM user_permissions 
        WHERE user_id = p_user_id 
        AND permission_type IN ('evidence_manage', 'admin_full_access')
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      ) THEN
        RETURN FALSE;
      END IF;
      
      -- Get current chain of custody
      SELECT chain_of_custody INTO current_custody
      FROM evidence_items
      WHERE id = p_evidence_id;
      
      -- Create new custody entry
      new_custody_entry := jsonb_build_object(
        'timestamp', CURRENT_TIMESTAMP,
        'user_id', p_user_id,
        'action', p_action,
        'location', p_location,
        'notes', p_notes
      );
      
      -- Update chain of custody
      IF current_custody IS NULL THEN
        updated_custody := jsonb_build_array(new_custody_entry);
      ELSE
        updated_custody := current_custody || new_custody_entry;
      END IF;
      
      -- Update evidence record
      UPDATE evidence_items 
      SET 
        chain_of_custody = updated_custody,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = p_evidence_id;
      
      RETURN TRUE;
    END;
    $$;
  `);
  
  // Function for risk score calculations and reporting
  await knex.raw(`
    CREATE OR REPLACE FUNCTION calculate_risk_metrics()
    RETURNS TABLE (
      total_risks INTEGER,
      high_risk_count INTEGER,
      critical_risk_count INTEGER,
      avg_risk_score NUMERIC,
      risks_by_type JSONB,
      overdue_reviews INTEGER
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      RETURN QUERY
      WITH risk_stats AS (
        SELECT 
          COUNT(*)::INTEGER as total,
          COUNT(*) FILTER (WHERE risk_score >= 50)::INTEGER as high_risk,
          COUNT(*) FILTER (WHERE risk_score >= 80)::INTEGER as critical_risk,
          AVG(risk_score) as avg_score,
          COUNT(*) FILTER (WHERE next_review_date < CURRENT_TIMESTAMP AND status != 'resolved')::INTEGER as overdue
        FROM risk_assessments
        WHERE status != 'resolved'
      ),
      risk_by_type AS (
        SELECT jsonb_object_agg(
          risk_type, 
          jsonb_build_object(
            'count', count,
            'avg_score', avg_score
          )
        ) as by_type
        FROM (
          SELECT 
            risk_type,
            COUNT(*)::INTEGER as count,
            AVG(risk_score) as avg_score
          FROM risk_assessments
          WHERE status != 'resolved'
          GROUP BY risk_type
        ) t
      )
      SELECT 
        rs.total,
        rs.high_risk,
        rs.critical_risk,
        rs.avg_score,
        rt.by_type,
        rs.overdue
      FROM risk_stats rs, risk_by_type rt;
    END;
    $$;
  `);
  
  // Function for user activity summary
  await knex.raw(`
    CREATE OR REPLACE FUNCTION get_user_activity_summary(
      p_user_id UUID,
      p_days INTEGER DEFAULT 30
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      activity_summary JSONB;
    BEGIN
      WITH activity_stats AS (
        SELECT 
          COUNT(*) FILTER (WHERE action_type = 'login') as login_count,
          COUNT(*) FILTER (WHERE action_type = 'create') as creates,
          COUNT(*) FILTER (WHERE action_type = 'update') as updates,
          COUNT(*) FILTER (WHERE action_type = 'delete') as deletes,
          COUNT(*) FILTER (WHERE action_type = 'download') as downloads,
          COUNT(DISTINCT DATE(timestamp)) as active_days,
          MAX(timestamp) as last_activity
        FROM audit_log
        WHERE user_id = p_user_id 
          AND timestamp >= CURRENT_TIMESTAMP - (p_days || ' days')::INTERVAL
      ),
      recent_actions AS (
        SELECT json_agg(
          json_build_object(
            'action', action_type,
            'resource', resource_type,
            'timestamp', timestamp
          ) ORDER BY timestamp DESC
        ) as recent
        FROM (
          SELECT action_type, resource_type, timestamp
          FROM audit_log
          WHERE user_id = p_user_id
          ORDER BY timestamp DESC
          LIMIT 10
        ) ra
      )
      SELECT jsonb_build_object(
        'period_days', p_days,
        'stats', row_to_json(ast),
        'recent_actions', ra.recent
      ) INTO activity_summary
      FROM activity_stats ast, recent_actions ra;
      
      RETURN activity_summary;
    END;
    $$;
  `);
  
  // Function for communication thread aggregation
  await knex.raw(`
    CREATE OR REPLACE FUNCTION get_communication_thread(
      p_thread_id UUID,
      p_user_id UUID
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      thread_data JSONB;
      user_can_access BOOLEAN;
    BEGIN
      -- Check user permissions for communication access
      SELECT EXISTS(
        SELECT 1 FROM user_permissions
        WHERE user_id = p_user_id
        AND permission_type IN ('communications_read', 'admin_full_access')
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      ) INTO user_can_access;
      
      IF NOT user_can_access THEN
        RETURN jsonb_build_object('error', 'Access denied');
      END IF;
      
      -- Aggregate thread communications
      WITH thread_comms AS (
        SELECT 
          c.*,
          fs.name as from_name,
          ts.name as to_name
        FROM communications c
        LEFT JOIN stakeholders fs ON c.from_stakeholder_id = fs.id
        LEFT JOIN stakeholders ts ON c.to_stakeholder_id = ts.id
        WHERE c.thread_id = p_thread_id
        ORDER BY c.created_at
      )
      SELECT jsonb_build_object(
        'thread_id', p_thread_id,
        'message_count', COUNT(*),
        'participants', array_agg(DISTINCT COALESCE(from_name, to_name)),
        'date_range', jsonb_build_object(
          'start', MIN(created_at),
          'end', MAX(created_at)
        ),
        'messages', json_agg(
          json_build_object(
            'id', id,
            'type', type,
            'subject', subject,
            'direction', direction,
            'from', from_name,
            'to', to_name,
            'sent_at', sent_at,
            'status', status
          ) ORDER BY created_at
        )
      ) INTO thread_data
      FROM thread_comms;
      
      RETURN thread_data;
    END;
    $$;
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.raw('DROP FUNCTION IF EXISTS search_stakeholders(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER)');
  await knex.raw('DROP FUNCTION IF EXISTS access_document(UUID, UUID, TEXT, INET, TEXT)');
  await knex.raw('DROP FUNCTION IF EXISTS update_evidence_custody(UUID, UUID, TEXT, TEXT, TEXT)');
  await knex.raw('DROP FUNCTION IF EXISTS calculate_risk_metrics()');
  await knex.raw('DROP FUNCTION IF EXISTS get_user_activity_summary(UUID, INTEGER)');
  await knex.raw('DROP FUNCTION IF EXISTS get_communication_thread(UUID, UUID)');
};