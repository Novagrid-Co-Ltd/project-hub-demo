-- サブタスクテーブル（extracted_itemsの子タスク）
CREATE TABLE subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_item_id UUID NOT NULL REFERENCES extracted_items(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subtasks_parent ON subtasks(parent_item_id);

CREATE TRIGGER subtasks_updated_at
  BEFORE UPDATE ON subtasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
