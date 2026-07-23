const sql = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS persons (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  thumbnail_url TEXT,
  notes TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'public',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS face_embeddings (
  id SERIAL PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  embedding vector(576) NOT NULL,
  lbp_embedding jsonb,
  hog_embedding jsonb,
  dct_embedding jsonb,
  clbp_embedding jsonb,
  lpq_embedding jsonb,
  image_url TEXT,
  confidence REAL NOT NULL DEFAULT 1.0,
  quality_score REAL NOT NULL DEFAULT 1.0,
  algorithm_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recognition_logs (
  id SERIAL PRIMARY KEY,
  person_id INTEGER REFERENCES persons(id) ON DELETE SET NULL,
  confidence REAL,
  recognized INTEGER NOT NULL DEFAULT 0,
  processing_time_ms REAL NOT NULL DEFAULT 0,
  algorithm_version TEXT,
  quality_score REAL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning_runs (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  faces_added INTEGER NOT NULL DEFAULT 0,
  persons_added INTEGER NOT NULL DEFAULT 0,
  max_images INTEGER NOT NULL DEFAULT 20,
  error_message TEXT,
  errors INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS experiments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  algorithm_version TEXT NOT NULL,
  parameters jsonb NOT NULL,
  metrics jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS embedding_idx ON face_embeddings USING hnsw (embedding vector_cosine_ops);
`;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/facevision';

async function main() {
  if (!connectionString.includes('neon.tech')) {
    console.log("Not a Neon database connection. Please use run_migration_direct.cjs or a standard PG client.");
    process.exit(1);
  }

  // Split statements by semicolon and clean them up
  const statements = sql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);

  console.log(`Sending ${statements.length} migration statements sequentially over HTTPS...`);

  const neonHost = new URL(connectionString).host;

  for (let i = 0; i < statements.length; i++) {
    const query = statements[i] + ';';
    console.log(`Executing statement ${i + 1}/${statements.length}...`);

    const res = await fetch(`https://${neonHost}/sql`, {
      method: 'POST',
      headers: {
        'Neon-Connection-String': connectionString
      },
      body: JSON.stringify({ query })
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`Statement ${i + 1} failed:`, text);
      process.exit(1);
    }
  }

  console.log("All migrations executed successfully!");
}

main().catch(console.error);
