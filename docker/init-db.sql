-- ==============================================================================
-- KeyCraft 3D - Khởi tạo Database & Extensions cho PostgreSQL 17
-- ==============================================================================

-- 1. Kích hoạt extension pgvector phục vụ Semantic Search & RAG âm học bàn phím
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Kích hoạt extension uuid-ossp hỗ trợ tạo UUID ngẫu nhiên
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
