# incident-intelligence-rag

[![CI](https://github.com/LeandroGusmao/incident-intelligence-rag/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/LeandroGusmao/incident-intelligence-rag/actions/workflows/ci.yml)

> 🚧 **Under construction.** The project is in its foundation phase: the API
> skeleton and tooling exist, but it doesn't retrieve or answer anything yet.

Incident Intelligence is a small developer tool that searches historical
engineering context (past incidents, GitHub issues, pull requests and source
code) to help investigate a new issue. It retrieves the relevant evidence and
produces a grounded investigation summary with citations to its sources.

It is intentionally **not** an autonomous coding agent. It points to evidence;
it doesn't fix the issue.

This is a portfolio project for learning and demonstrating production-minded
RAG. The focus is on engineering decisions and measured retrieval quality, not
on UI or feature count.

## Planned design

- **Hybrid retrieval:** exact vector search with pgvector plus PostgreSQL
  full-text search, merged with Reciprocal Rank Fusion.
- **Link expansion:** one hop through explicit references between sources
  (incident → pull request → issue), never inferred by the model.
- **Idempotent, versioned ingestion:** re-running it never duplicates chunks;
  changing the chunker or embedding model reindexes everything.
- **Abstention:** a deterministic evidence gate filters out weak retrieval
  before the LLM is called, and the model can still decline when the evidence
  doesn't answer the question. Abstention rates are measured in the eval, not
  assumed.
- **Validated output:** structured LLM output checked with Zod, with every
  citation verified against the context actually sent to the model.
- **Prompt-injection hygiene:** retrieved text is treated as untrusted data,
  used only as evidence and never followed as instructions.
- **Measured retrieval:** Recall@5, Hit Rate@5, MRR and abstention per query
  category, comparing vector, hybrid and hybrid-with-links on a held-out test
  split.
- **Fictional dataset:** a made-up billing service, so the repository is safe
  to publish.

## Roadmap

1. **Foundation** (in progress): API skeleton, tooling, CI, local
   PostgreSQL + pgvector, migrations, dataset and eval set.
2. **RAG core:** ingestion, embeddings, vector search, a baseline eval and
   structured answers with citations.
3. **Retrieval quality:** full-text search, RRF, link expansion, the evidence
   gate and context budgeting.
4. **Reliability and write-up:** structured logs, final evaluation on the
   held-out split, and documentation.

## Tech stack

Node.js 24 · TypeScript 7 · Hono with `@hono/zod-openapi` · Jest · Oxlint ·
Prettier. Planned: PostgreSQL + pgvector (via `pg`, no ORM) and the OpenAI API.

## Running what exists

Requires Node.js 24 or later.

```bash
npm install
cp .env.example .env
npm run dev            # http://localhost:3000/health, /openapi.json and /docs (Swagger UI)
npm run check          # typecheck, lint, format check and tests
```

## License

[MIT](LICENSE)
