-- D1 Database schema for storing thebash.com content
-- Create this table in your D1 database before deploying the worker

DROP TABLE IF EXISTS content;

CREATE TABLE content (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  page_title TEXT,
  quotes_count INTEGER NOT NULL,
  quotes TEXT NOT NULL, -- JSON string of quotes array
  extracted_at TEXT NOT NULL,
  saved_at TEXT NOT NULL
);

-- Create indexes for common queries
CREATE INDEX idx_saved_at ON content(saved_at DESC);
CREATE INDEX idx_url ON content(url);

-- Example query to verify
-- SELECT COUNT(*) FROM content;
