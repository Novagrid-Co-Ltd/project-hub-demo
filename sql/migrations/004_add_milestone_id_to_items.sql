-- extracted_items に milestone_id カラムを追加
-- TODO/決定事項をマイルストーンに紐付け可能にする
ALTER TABLE extracted_items ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_extracted_items_milestone ON extracted_items(milestone_id);
