-- row_meeting_raw に project_name カラムを追加
-- カレンダーで会議作成時に【定例】+PJ名 の形式でPJ名を設定する想定
ALTER TABLE row_meeting_raw ADD COLUMN IF NOT EXISTS project_name TEXT;

-- event_summary から【定例】+PJ名パターンでproject_nameを自動抽出するための
-- インデックス（検索用）
CREATE INDEX IF NOT EXISTS idx_row_meeting_raw_project_name ON row_meeting_raw(project_name);
