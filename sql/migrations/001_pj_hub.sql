-- Drop 003 tables (empty, safe to drop)
DROP TRIGGER IF EXISTS extracted_items_updated_at ON extracted_items;
DROP TRIGGER IF EXISTS projects_updated_at ON extracted_items;
DROP TABLE IF EXISTS extracted_items CASCADE;
DROP TABLE IF EXISTS project_meetings CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- ============================================
-- PJ Hub v2
-- ============================================

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'on_hold', 'completed', 'archived')),
  calendar_keywords JSONB DEFAULT '[]',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES master_person_identity(id),
  role TEXT DEFAULT '',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, member_id)
);

CREATE TABLE phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  actual_end_date DATE,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed')),
  created_by TEXT DEFAULT 'manual'
    CHECK (created_by IN ('manual', 'ai')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES phases(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'achieved')),
  achieved_date DATE,
  source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual', 'ai')),
  source_meeting_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE project_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL,
  matched_by TEXT DEFAULT 'manual'
    CHECK (matched_by IN ('manual', 'ai')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, meeting_id)
);

CREATE TABLE extracted_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  type TEXT NOT NULL
    CHECK (type IN ('todo', 'decision', 'issue', 'phase_change')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'confirmed', 'rejected')),
  ai_original JSONB NOT NULL,
  content TEXT NOT NULL,
  assignee_member_id UUID REFERENCES master_person_identity(id) ON DELETE SET NULL,
  due_date DATE,
  priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('high', 'medium', 'low')),
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_member ON project_members(member_id);
CREATE INDEX idx_phases_project ON phases(project_id);
CREATE INDEX idx_phases_status ON phases(status);
CREATE INDEX idx_milestones_project ON milestones(project_id);
CREATE INDEX idx_milestones_phase ON milestones(phase_id);
CREATE INDEX idx_project_meetings_project ON project_meetings(project_id);
CREATE INDEX idx_project_meetings_meeting ON project_meetings(meeting_id);
CREATE INDEX idx_extracted_items_project ON extracted_items(project_id);
CREATE INDEX idx_extracted_items_meeting ON extracted_items(meeting_id);
CREATE INDEX idx_extracted_items_status ON extracted_items(status);
CREATE INDEX idx_extracted_items_type ON extracted_items(type);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER phases_updated_at
  BEFORE UPDATE ON phases FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER milestones_updated_at
  BEFORE UPDATE ON milestones FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER extracted_items_updated_at
  BEFORE UPDATE ON extracted_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
