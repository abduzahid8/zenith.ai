-- =====================================================
-- 009 — Zenyth Verified Credentials (§22)
-- Extends the existing task/session engine: certification reads evidence
-- from tasks/sessions/user_metrics_history, never replaces them.
-- Every user table is RLS-filtered by user_id = auth.uid().
-- Credential versions are pinned on issuance (§23).
-- =====================================================

-- 1. Catalog: available certifications -------------------
CREATE TABLE IF NOT EXISTS credential_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT DEFAULT '',
    credential_level TEXT NOT NULL CHECK (credential_level IN ('completion', 'verified-skill', 'professional')),
    difficulty TEXT DEFAULT 'beginner',
    estimated_hours INTEGER DEFAULT 10,
    required_score INTEGER NOT NULL DEFAULT 80,
    readiness_threshold INTEGER NOT NULL DEFAULT 75,
    evidence_hobby_ids TEXT[] NOT NULL DEFAULT '{}',
    skills JSONB NOT NULL DEFAULT '[]',
    requirements JSONB NOT NULL DEFAULT '[]',
    assessment JSONB NOT NULL DEFAULT '{"questionCount": 20, "timeLimitMinutes": 30, "bankSize": 80}',
    requires_project BOOLEAN NOT NULL DEFAULT TRUE,
    requires_identity_verification BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    version TEXT NOT NULL DEFAULT '1.0',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enrollment + progress per user ----------------------
CREATE TABLE IF NOT EXISTS user_credential_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credential_program_id UUID NOT NULL REFERENCES credential_programs(id) ON DELETE CASCADE,
    program_version TEXT NOT NULL DEFAULT '1.0',
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    progress_percent INTEGER NOT NULL DEFAULT 0,
    learning_completion INTEGER NOT NULL DEFAULT 0,
    assessment_score NUMERIC,
    project_score NUMERIC,
    readiness_score NUMERIC,
    status TEXT NOT NULL DEFAULT 'learning'
        CHECK (status IN ('learning', 'ready', 'in_assessment', 'remediation', 'passed', 'failed')),
    identity_verified BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, credential_program_id)
);

-- 3. Exam attempts ---------------------------------------
CREATE TABLE IF NOT EXISTS credential_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credential_program_id UUID NOT NULL REFERENCES credential_programs(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    score NUMERIC,
    passed BOOLEAN,
    answers JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, credential_program_id, attempt_number)
);

-- 4. Evidence linked to engine data ----------------------
CREATE TABLE IF NOT EXISTS credential_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credential_program_id UUID NOT NULL REFERENCES credential_programs(id) ON DELETE CASCADE,
    evidence_type TEXT NOT NULL CHECK (evidence_type IN (
        'task_completed', 'session_completed', 'assessment',
        'practical_assignment', 'final_project', 'final_assessment'
    )),
    title TEXT NOT NULL,
    score NUMERIC,
    reference_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_credential_evidence_user_program
    ON credential_evidence (user_id, credential_program_id);

-- 5. Issued credentials (the verifiable record) ----------
CREATE TABLE IF NOT EXISTS issued_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credential_program_id UUID NOT NULL REFERENCES credential_programs(id),
    program_version TEXT NOT NULL,
    holder_name TEXT NOT NULL,
    final_score NUMERIC NOT NULL,
    grade TEXT NOT NULL DEFAULT 'pass',
    skills JSONB NOT NULL DEFAULT '[]',
    evidence JSONB NOT NULL DEFAULT '{}',
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('pending', 'active', 'expired', 'revoked', 'suspended')),
    verification_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_issued_credentials_credential_id
    ON issued_credentials (credential_id);
CREATE INDEX IF NOT EXISTS idx_issued_credentials_user
    ON issued_credentials (user_id);

-- Public verification reads by credential_id WITHOUT login.
-- Only non-revoked, non-sensitive columns are exposed via this view.
CREATE OR REPLACE VIEW public_credential_verification AS
SELECT
    credential_id,
    holder_name,
    final_score,
    grade,
    skills,
    evidence,
    issued_at,
    expires_at,
    status,
    program_version,
    (SELECT title FROM credential_programs WHERE credential_programs.id = issued_credentials.credential_program_id) AS program_title,
    (SELECT credential_level FROM credential_programs WHERE credential_programs.id = issued_credentials.credential_program_id) AS credential_level
FROM issued_credentials;

-- 6. Seed catalog (first five credentials) ---------------
INSERT INTO credential_programs
    (slug, code, title, subtitle, credential_level, estimated_hours, required_score, readiness_threshold, evidence_hobby_ids, skills, requirements, assessment, requires_project, requires_identity_verification, version)
VALUES
    ('ai-foundations', 'AIF', 'Zenyth Verified Skill — AI Foundations',
     'AI concepts, LLMs, prompting, generative AI and safety', 'verified-skill', 12, 80, 75,
     ARRAY['reading', 'python'],
     '[{"key":"ai_fundamentals","name":"AI Fundamentals","weight":0.2,"minimumScore":65},{"key":"prompt_engineering","name":"Prompt Engineering","weight":0.25,"minimumScore":65},{"key":"generative_ai","name":"Generative AI","weight":0.2,"minimumScore":65},{"key":"llm_concepts","name":"LLM Concepts","weight":0.15,"minimumScore":65},{"key":"ai_safety","name":"AI Safety","weight":0.1,"minimumScore":65},{"key":"practical_ai_usage","name":"Practical AI Usage","weight":0.1,"minimumScore":65}]',
     '[{"key":"curriculum"},{"key":"practical"},{"key":"knowledge"},{"key":"project"},{"key":"final"}]',
     '{"questionCount": 30, "timeLimitMinutes": 40, "bankSize": 120}', TRUE, FALSE, '1.0'),
    ('prompt-engineering', 'PME', 'Zenyth Verified Skill — Prompt Engineering',
     'Prompt design, context, structured output and AI workflows', 'verified-skill', 10, 80, 75,
     ARRAY['reading', 'python', 'writing'],
     '[{"key":"prompt_design","name":"Prompt Design","weight":0.3,"minimumScore":65},{"key":"context_management","name":"Context Management","weight":0.2,"minimumScore":65},{"key":"structured_output","name":"Structured Output","weight":0.2,"minimumScore":65},{"key":"evaluation","name":"Prompt Evaluation","weight":0.15,"minimumScore":65},{"key":"ai_workflows","name":"AI Workflows","weight":0.15,"minimumScore":65}]',
     '[{"key":"curriculum"},{"key":"practical"},{"key":"knowledge"},{"key":"project"},{"key":"final"}]',
     '{"questionCount": 25, "timeLimitMinutes": 35, "bankSize": 100}', TRUE, FALSE, '1.0'),
    ('data-analytics-foundation', 'DAF', 'Zenyth Certified Data Analyst — Foundation',
     'Excel, SQL, visualization and business analytics', 'professional', 30, 82, 80,
     ARRAY['python', 'reading'],
     '[{"key":"data_cleaning","name":"Data Cleaning","weight":0.15,"minimumScore":65},{"key":"excel","name":"Excel","weight":0.15,"minimumScore":65},{"key":"data_visualization","name":"Data Visualization","weight":0.15,"minimumScore":65},{"key":"sql_fundamentals","name":"SQL Fundamentals","weight":0.2,"minimumScore":65},{"key":"analytical_thinking","name":"Analytical Thinking","weight":0.15,"minimumScore":65},{"key":"business_metrics","name":"Business Metrics","weight":0.1,"minimumScore":60},{"key":"data_interpretation","name":"Data Interpretation","weight":0.1,"minimumScore":60}]',
     '[{"key":"path"},{"key":"assignments"},{"key":"portfolio"},{"key":"final"},{"key":"breadth"}]',
     '{"questionCount": 60, "timeLimitMinutes": 75, "bankSize": 500}', TRUE, TRUE, '1.0'),
    ('python-foundations', 'PYF', 'Zenyth Verified Skill — Python Foundations',
     'Syntax, data structures, functions and program logic', 'verified-skill', 15, 80, 75,
     ARRAY['python'],
     '[{"key":"syntax","name":"Syntax & Basics","weight":0.2,"minimumScore":65},{"key":"data_structures","name":"Data Structures","weight":0.25,"minimumScore":65},{"key":"functions","name":"Functions","weight":0.2,"minimumScore":65},{"key":"logic","name":"Program Logic","weight":0.2,"minimumScore":65},{"key":"basic_programming","name":"Basic Programming","weight":0.15,"minimumScore":65}]',
     '[{"key":"curriculum"},{"key":"practical"},{"key":"knowledge"},{"key":"project"},{"key":"final"}]',
     '{"questionCount": 30, "timeLimitMinutes": 45, "bankSize": 150}', TRUE, FALSE, '1.0'),
    ('ai-productivity', 'AIP', 'Zenyth Certificate — AI Productivity',
     'Research, writing, analysis and automation with AI', 'completion', 8, 70, 65,
     ARRAY['reading', 'english', 'planning'],
     '[{"key":"ai_research","name":"AI Research","weight":0.25,"minimumScore":55},{"key":"ai_writing","name":"AI Writing","weight":0.25,"minimumScore":55},{"key":"ai_analysis","name":"AI Analysis","weight":0.2,"minimumScore":55},{"key":"automation","name":"Automation Basics","weight":0.15,"minimumScore":55},{"key":"ai_workflows","name":"AI Workflows","weight":0.15,"minimumScore":55}]',
     '[{"key":"modules"},{"key":"time"},{"key":"sessions"}]',
     '{"questionCount": 20, "timeLimitMinutes": 30, "bankSize": 80}', FALSE, FALSE, '1.0')
ON CONFLICT (slug) DO NOTHING;

-- 7. RLS --------------------------------------------------
ALTER TABLE credential_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credential_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE issued_credentials ENABLE ROW LEVEL SECURITY;

-- Catalog is readable by everyone (including anon for verification).
DROP POLICY IF EXISTS "credential_programs readable by all" ON credential_programs;
CREATE POLICY "credential_programs readable by all"
    ON credential_programs FOR SELECT USING (true);

DROP POLICY IF EXISTS "users manage own credential progress" ON user_credential_progress;
CREATE POLICY "users manage own credential progress"
    ON user_credential_progress FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users manage own credential attempts" ON credential_attempts;
CREATE POLICY "users manage own credential attempts"
    ON credential_attempts FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users manage own credential evidence" ON credential_evidence;
CREATE POLICY "users manage own credential evidence"
    ON credential_evidence FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users read own issued credentials" ON issued_credentials;
CREATE POLICY "users read own issued credentials"
    ON issued_credentials FOR SELECT USING (user_id = auth.uid());

-- updated_at trigger (reuse helper when present)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        DROP TRIGGER IF EXISTS trg_user_credential_progress_updated ON user_credential_progress;
        CREATE TRIGGER trg_user_credential_progress_updated
            BEFORE UPDATE ON user_credential_progress
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
