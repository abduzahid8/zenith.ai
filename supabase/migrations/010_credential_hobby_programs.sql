-- =====================================================
-- 010 — Credentials re-anchored to the existing solution
-- Replaces the generic seed programs with one program per REAL hobby.
-- Each skill = one week of that hobby's 28-day task bank (dayRange),
-- so daily tasks, session artifacts and exams all read the same
-- curriculum the user already trains. User tables are untouched.
-- =====================================================

DELETE FROM credential_programs
WHERE slug IN ('ai-foundations', 'prompt-engineering', 'data-analytics-foundation', 'ai-productivity');

-- python-foundations already exists from 009 with the wrong shape: refresh it.
DELETE FROM credential_programs WHERE slug = 'python-foundations';

INSERT INTO credential_programs
    (slug, code, title, subtitle, credential_level, estimated_hours, required_score, readiness_threshold, evidence_hobby_ids, skills, requirements, assessment, requires_project, requires_identity_verification, version)
VALUES
    ('python-foundations', 'PYF', 'Zenyth Verified Skill — Python Foundations',
     'The same 28-day Python path you already train daily', 'verified-skill', 15, 80, 75,
     ARRAY['python', 'coding'],
     '[{"key":"syntax","name":"Syntax & Basics","weight":0.2,"minimumScore":65,"dayRange":[1,7]},{"key":"logic","name":"Control Flow & Logic","weight":0.25,"minimumScore":65,"dayRange":[8,14]},{"key":"functions","name":"Functions & Data","weight":0.25,"minimumScore":65,"dayRange":[15,21]},{"key":"basic_programming","name":"Projects & OOP","weight":0.3,"minimumScore":65,"dayRange":[22,28]}]',
     '[{"key":"curriculum"},{"key":"sessions"},{"key":"knowledge"},{"key":"project"},{"key":"final"}]',
     '{"questionCount": 20, "timeLimitMinutes": 30, "bankSize": 40}', TRUE, FALSE, '1.0'),
    ('chess-foundations', 'CHF', 'Zenyth Verified Skill — Chess Foundations',
     'The same 28-day chess path you already train daily', 'verified-skill', 15, 80, 75,
     ARRAY['chess'],
     '[{"key":"rules","name":"Rules & Basics","weight":0.2,"minimumScore":65,"dayRange":[1,7]},{"key":"openings","name":"Openings","weight":0.25,"minimumScore":65,"dayRange":[8,14]},{"key":"endgames","name":"Endgames","weight":0.25,"minimumScore":65,"dayRange":[15,21]},{"key":"tactics","name":"Tactics & Strategy","weight":0.3,"minimumScore":65,"dayRange":[22,28]}]',
     '[{"key":"curriculum"},{"key":"sessions"},{"key":"knowledge"},{"key":"project"},{"key":"final"}]',
     '{"questionCount": 20, "timeLimitMinutes": 30, "bankSize": 40}', TRUE, FALSE, '1.0'),
    ('reading-mastery', 'RDG', 'Zenyth Verified Skill — Reading Mastery',
     'The same 28-day reading path you already train daily', 'verified-skill', 12, 80, 75,
     ARRAY['reading'],
     '[{"key":"techniques","name":"Reading Techniques","weight":0.25,"minimumScore":65,"dayRange":[1,7]},{"key":"analysis","name":"Critical Analysis","weight":0.3,"minimumScore":65,"dayRange":[8,14]},{"key":"nonfiction","name":"Non-fiction System","weight":0.25,"minimumScore":65,"dayRange":[15,21]},{"key":"system","name":"Reader''s System","weight":0.2,"minimumScore":65,"dayRange":[22,28]}]',
     '[{"key":"curriculum"},{"key":"sessions"},{"key":"knowledge"},{"key":"project"},{"key":"final"}]',
     '{"questionCount": 20, "timeLimitMinutes": 30, "bankSize": 40}', TRUE, FALSE, '1.0'),
    ('english-foundations', 'ENF', 'Zenyth Verified Skill — English Foundations',
     'The same 28-day English path you already train daily', 'verified-skill', 14, 80, 75,
     ARRAY['english'],
     '[{"key":"grammar","name":"Grammar Basics","weight":0.3,"minimumScore":65,"dayRange":[1,7]},{"key":"vocabulary","name":"Vocabulary","weight":0.25,"minimumScore":65,"dayRange":[8,14]},{"key":"speaking","name":"Speaking","weight":0.25,"minimumScore":65,"dayRange":[15,21]},{"key":"writing","name":"Writing & Reading","weight":0.2,"minimumScore":65,"dayRange":[22,28]}]',
     '[{"key":"curriculum"},{"key":"sessions"},{"key":"knowledge"},{"key":"project"},{"key":"final"}]',
     '{"questionCount": 20, "timeLimitMinutes": 30, "bankSize": 40}', TRUE, FALSE, '1.0'),
    ('chinese-hsk1-start', 'CHN', 'Zenyth Verified Skill — Chinese HSK 1 Start',
     'The same 28-day Chinese path you already train daily', 'verified-skill', 14, 80, 75,
     ARRAY['chinese'],
     '[{"key":"pinyin","name":"Pinyin & Tones","weight":0.3,"minimumScore":65,"dayRange":[1,7]},{"key":"characters","name":"Characters","weight":0.25,"minimumScore":65,"dayRange":[8,14]},{"key":"phrases","name":"Everyday Phrases","weight":0.25,"minimumScore":65,"dayRange":[15,21]},{"key":"grammar","name":"Basic Grammar","weight":0.2,"minimumScore":65,"dayRange":[22,28]}]',
     '[{"key":"curriculum"},{"key":"sessions"},{"key":"knowledge"},{"key":"project"},{"key":"final"}]',
     '{"questionCount": 20, "timeLimitMinutes": 30, "bankSize": 40}', TRUE, FALSE, '1.0')
ON CONFLICT (slug) DO NOTHING;
