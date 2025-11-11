-- D1 Database schema for Lead Management System
-- Create these tables in your D1 database before deploying the worker

-- Drop existing tables (in reverse order due to foreign keys)
DROP TABLE IF EXISTS ai_responses;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS files;
DROP TABLE IF EXISTS leads;

-- Leads table - stores main lead information
CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  phone TEXT,
  company TEXT,
  source_url TEXT NOT NULL,
  source_platform TEXT,
  status TEXT DEFAULT 'new', -- new, contacted, qualified, converted, lost
  priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
  tags TEXT, -- JSON array of tags
  custom_fields TEXT, -- JSON object for additional fields
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Conversations table - groups messages into chat threads
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  platform TEXT NOT NULL, -- website, facebook, email, etc.
  status TEXT DEFAULT 'active', -- active, closed, archived
  last_message_at TEXT,
  message_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- Messages table - individual chat messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  sender_type TEXT NOT NULL, -- lead, agent, system
  sender_name TEXT,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- text, image, file, system
  metadata TEXT, -- JSON object for additional data
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- AI Responses table - stores generated AI responses for review
CREATE TABLE ai_responses (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  message_id TEXT, -- The message being responded to
  response_text TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, sent
  confidence_score REAL,
  model_used TEXT,
  prompt_used TEXT,
  edited_text TEXT, -- If user edits the response
  reviewed_by TEXT,
  reviewed_at TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
);

-- Files table - metadata for files stored in R2
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  lead_id TEXT,
  conversation_id TEXT,
  message_id TEXT,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  r2_key TEXT NOT NULL, -- R2 object key
  r2_bucket TEXT NOT NULL,
  url TEXT,
  uploaded_by TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_priority ON leads(priority);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_email ON leads(email);

CREATE INDEX idx_conversations_lead_id ON conversations(lead_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_lead_id ON messages(lead_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

CREATE INDEX idx_ai_responses_status ON ai_responses(status);
CREATE INDEX idx_ai_responses_conversation_id ON ai_responses(conversation_id);
CREATE INDEX idx_ai_responses_created_at ON ai_responses(created_at DESC);

CREATE INDEX idx_files_lead_id ON files(lead_id);
CREATE INDEX idx_files_conversation_id ON files(conversation_id);

-- Example queries for verification
-- SELECT COUNT(*) FROM leads;
-- SELECT COUNT(*) FROM conversations;
-- SELECT COUNT(*) FROM ai_responses WHERE status = 'pending';
