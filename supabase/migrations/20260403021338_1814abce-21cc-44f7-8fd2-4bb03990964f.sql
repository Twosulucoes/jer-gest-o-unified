-- Seed test data for validate test
INSERT INTO events (id, name, slug, year, status)
VALUES ('a0000000-0000-0000-0000-000000000001', 'JER 2025 Teste', 'jer-2025-teste', 2025, 'draft');

INSERT INTO institutions (id, name, slug, is_active)
VALUES ('b0000000-0000-0000-0000-000000000001', 'Escola Estadual Professora Genira Brito Rodrigues', 'escola-estadual-professora-genira-brito-rodrigues', true);

INSERT INTO delegations (id, event_id, institution_id, status)
VALUES ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'confirmed');

INSERT INTO sports (id, event_id, name, slug)
VALUES ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Futsal', 'futsal');

INSERT INTO categories (id, event_id, name, slug)
VALUES ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Futsal Cantá', 'futsal-canta');