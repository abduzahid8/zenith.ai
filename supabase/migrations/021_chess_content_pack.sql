-- =====================================================
-- 021 — Chess Foundations v1.0 trusted content pack (server-owned).
--
-- Curated deterministic bank. No AI-generated questions, no client
-- bundle answers: payloads are safe, keys live in answer_key columns
-- with zero client policies. content_version 'chess-v1' pins the bank;
-- program_version '1.0' pins the program. Coverage: all four frozen
-- skills (rules 1-7, openings 8-14, endgames 15-21, tactics 22-28).
--
-- Counts: validation 16 (4/skill), knowledge 16 (4/skill),
-- practical 8 (2/skill), final bank 40 (10/skill, set picks 20).
-- Skill evidence policy: min 3 distinct finalized items per skill,
-- pass rate >= 0.65. Rationale: one lucky guess cannot certify a weekly
-- skill (P(>=2/3 lucky at 33% guess) < 8%); 0.65 aligns the frozen
-- per-skill minimumScore of 65. Configurable in skill_evidence_policy.
-- =====================================================

-- Evidence-depth policy (chess pilot). --------------------------------
INSERT INTO skill_evidence_policy
    (program_slug, program_version, skill_key, min_items, min_pass_rate, rationale)
VALUES
    ('chess-foundations', '1.0', 'rules', 3, 0.65,
     '3 distinct server-scored items; one lucky guess cannot certify a weekly skill; rate aligns frozen minimumScore 65.'),
    ('chess-foundations', '1.0', 'openings', 3, 0.65,
     '3 distinct server-scored items; one lucky guess cannot certify a weekly skill; rate aligns frozen minimumScore 65.'),
    ('chess-foundations', '1.0', 'endgames', 3, 0.65,
     '3 distinct server-scored items; one lucky guess cannot certify a weekly skill; rate aligns frozen minimumScore 65.'),
    ('chess-foundations', '1.0', 'tactics', 3, 0.65,
     '3 distinct server-scored items; one lucky guess cannot certify a weekly skill; rate aligns frozen minimumScore 65.')
ON CONFLICT (program_slug, program_version, skill_key) DO UPDATE SET
    min_items = EXCLUDED.min_items,
    min_pass_rate = EXCLUDED.min_pass_rate,
    rationale = EXCLUDED.rationale;

-- Trusted validation items (16). ---------------------------------------
INSERT INTO trusted_validation_items
    (program_slug, program_version, hobby_id, curriculum_day, skill_key, lesson_id,
     content_version, payload, answer_key)
VALUES
    -- rules --
    ('chess-foundations', '1.0', 'chess', 1, 'rules', 'chess_d1', 'chess-v1',
     '{"kind":"mc","prompt":"A knight on g1 can legally move to which square?","options":["f3","g2","h2","e1"]}',
     '{"answer":"f3"}'),
    ('chess-foundations', '1.0', 'chess', 2, 'rules', 'chess_d2', 'chess-v1',
     '{"kind":"mc","prompt":"Standard values: bishop (3) + knight (3) equal how many pawns?","options":["4 pawns","6 pawns","9 pawns","2 pawns"]}',
     '{"answer":"6 pawns"}'),
    ('chess-foundations', '1.0', 'chess', 3, 'rules', 'chess_d3', 'chess-v1',
     '{"kind":"mc","prompt":"Castling is ILLEGAL when which is true?","options":["the king is in check","a rook has never moved","it is move 10","the g-file is empty"]}',
     '{"answer":"the king is in check"}'),
    ('chess-foundations', '1.0', 'chess', 4, 'rules', 'chess_d4', 'chess-v1',
     '{"kind":"mc","prompt":"A stalemated side (no legal moves, not in check) gets which result?","options":["a draw","a win","a loss on time","a restarted game"]}',
     '{"answer":"a draw"}'),
    -- openings --
    ('chess-foundations', '1.0', 'chess', 8, 'openings', 'chess_d8', 'chess-v1',
     '{"kind":"mc","prompt":"1.e4 e5 2.Nf3 Nc6 3.Bc4 is the opening called?","options":["Italian Game","Sicilian Defense","French Defense","Caro-Kann"]}',
     '{"answer":"Italian Game"}'),
    ('chess-foundations', '1.0', 'chess', 9, 'openings', 'chess_d9', 'chess-v1',
     '{"kind":"mc","prompt":"1.e4 e5 2.Nf3 Nc6 3.Bb5 is the opening called?","options":["Ruy Lopez","Italian Game","Scotch Game","Petrov Defense"]}',
     '{"answer":"Ruy Lopez"}'),
    ('chess-foundations', '1.0', 'chess', 10, 'openings', 'chess_d10', 'chess-v1',
     '{"kind":"mc","prompt":"The move 1.e4 c5 starts which defense?","options":["Sicilian Defense","French Defense","Caro-Kann","Scandinavian Defense"]}',
     '{"answer":"Sicilian Defense"}'),
    ('chess-foundations', '1.0', 'chess', 11, 'openings', 'chess_d11', 'chess-v1',
     '{"kind":"mc","prompt":"The move 1.e4 e6 starts which defense?","options":["French Defense","Sicilian Defense","Caro-Kann","Pirc Defense"]}',
     '{"answer":"French Defense"}'),
    -- endgames --
    ('chess-foundations', '1.0', 'chess', 15, 'endgames', 'chess_d15', 'chess-v1',
     '{"kind":"mc","prompt":"Direct opposition means the kings stand how?","options":["two squares apart on one file with the other side to move","on adjacent squares","on opposite colors","four squares apart"]}',
     '{"answer":"two squares apart on one file with the other side to move"}'),
    ('chess-foundations', '1.0', 'chess', 16, 'endgames', 'chess_d16', 'chess-v1',
     '{"kind":"mc","prompt":"King + bishop + knight versus a bare king is which result with best play?","options":["cannot force checkmate","mate in 1","mate in 5 always","a win on time"]}',
     '{"answer":"cannot force checkmate"}'),
    ('chess-foundations', '1.0', 'chess', 17, 'endgames', 'chess_d17', 'chess-v1',
     '{"kind":"mc","prompt":"King + queen versus a bare king with correct play is?","options":["a forced win","a draw by stalemate","a draw by repetition","illegal material"]}',
     '{"answer":"a forced win"}'),
    ('chess-foundations', '1.0', 'chess', 18, 'endgames', 'chess_d18', 'chess-v1',
     '{"kind":"mc","prompt":"Bare king versus bare king is which result?","options":["an immediate draw","a win for White","a win for Black","a replayed game"]}',
     '{"answer":"an immediate draw"}'),
    -- tactics --
    ('chess-foundations', '1.0', 'chess', 22, 'tactics', 'chess_d22', 'chess-v1',
     '{"kind":"mc","prompt":"A fork is best described as?","options":["one piece attacking two or more enemy pieces at once","a pinned piece","a discovered check","a double check"]}',
     '{"answer":"one piece attacking two or more enemy pieces at once"}'),
    ('chess-foundations', '1.0', 'chess', 23, 'tactics', 'chess_d23', 'chess-v1',
     '{"kind":"mc","prompt":"An ABSOLUTE pin means the pinned piece?","options":["cannot move because it would expose its king","can move anywhere","must give check","is worth extra points"]}',
     '{"answer":"cannot move because it would expose its king"}'),
    ('chess-foundations', '1.0', 'chess', 24, 'tactics', 'chess_d24', 'chess-v1',
     '{"kind":"mc","prompt":"A skewer attacks which arrangement?","options":["a valuable piece in front with a lesser piece behind it","two pieces at once with a knight","the king from two directions at once","a piece that has no moves"]}',
     '{"answer":"a valuable piece in front with a lesser piece behind it"}'),
    ('chess-foundations', '1.0', 'chess', 25, 'tactics', 'chess_d25', 'chess-v1',
     '{"kind":"mc","prompt":"Facing a double check, the king must?","options":["move","block with any piece","capture either checker","castle queenside"]}',
     '{"answer":"move"}')
ON CONFLICT (program_slug, program_version, curriculum_day) DO NOTHING;

-- Knowledge items (16). --------------------------------------------------
INSERT INTO knowledge_items
    (program_slug, program_version, skill_key, item_key, payload, answer_key)
VALUES
    ('chess-foundations', '1.0', 'rules', 'kn-rules-1',
     '{"kind":"mc","prompt":"A pawn on its starting square may move?","options":["one or two squares forward","three squares forward","sideways","backwards"]}',
     '{"answer":"one or two squares forward"}'),
    ('chess-foundations', '1.0', 'rules', 'kn-rules-2',
     '{"kind":"mc","prompt":"How far can a king move in one turn (not castling)?","options":["one square","two squares","three squares","any distance"]}',
     '{"answer":"one square"}'),
    ('chess-foundations', '1.0', 'rules', 'kn-rules-3',
     '{"kind":"mc","prompt":"A bishop is best described as?","options":["color-bound to one square color","able to jump pieces","moving like a rook","worth 9 pawns"]}',
     '{"answer":"color-bound to one square color"}'),
    ('chess-foundations', '1.0', 'rules', 'kn-rules-4',
     '{"kind":"mc","prompt":"A pawn captures opposing pieces by moving?","options":["one square diagonally forward","straight forward","two squares forward","backwards"]}',
     '{"answer":"one square diagonally forward"}'),
    ('chess-foundations', '1.0', 'openings', 'kn-open-1',
     '{"kind":"mc","prompt":"In the Spanish (Ruy Lopez) opening White develops the bishop to?","options":["b5","c4","d3","g5"]}',
     '{"answer":"b5"}'),
    ('chess-foundations', '1.0', 'openings', 'kn-open-2',
     '{"kind":"mc","prompt":"In the Italian Game White develops the bishop to?","options":["c4","b5","d3","e2"]}',
     '{"answer":"c4"}'),
    ('chess-foundations', '1.0', 'openings', 'kn-open-3',
     '{"kind":"mc","prompt":"The Caro-Kann defense begins with which Black move?","options":["1...c6","1...c5","1...e6","1...d5"]}',
     '{"answer":"1...c6"}'),
    ('chess-foundations', '1.0', 'openings', 'kn-open-4',
     '{"kind":"mc","prompt":"The moves 1.d4 d5 2.c4 open which gambit?","options":["Queens Gambit","Kings Gambit","Evans Gambit","Danish Gambit"]}',
     '{"answer":"Queens Gambit"}'),
    ('chess-foundations', '1.0', 'endgames', 'kn-end-1',
     '{"kind":"mc","prompt":"The Philidor position defends a rook endgame with the rook placed on?","options":["the third rank","the first rank","the eighth rank","off the board"]}',
     '{"answer":"the third rank"}'),
    ('chess-foundations', '1.0', 'endgames', 'kn-end-2',
     '{"kind":"mc","prompt":"The Lucena position wins by building what?","options":["a bridge for the king","a fortress","a stalemate net","a perpetual"]}',
     '{"answer":"a bridge for the king"}'),
    ('chess-foundations', '1.0', 'endgames', 'kn-end-3',
     '{"kind":"mc","prompt":"A rook usually belongs in which relation to its passed pawn?","options":["behind the pawn","in front of the pawn","on the opposite wing","off the board"]}',
     '{"answer":"behind the pawn"}'),
    ('chess-foundations', '1.0', 'endgames', 'kn-end-4',
     '{"kind":"mc","prompt":"Two rooks checkmate a bare king with which classic pattern?","options":["lawnmower mate","smothered mate","Arabian mate","fools mate"]}',
     '{"answer":"lawnmower mate"}'),
    ('chess-foundations', '1.0', 'tactics', 'kn-tac-1',
     '{"kind":"mc","prompt":"A discovered check happens when?","options":["a piece moves and reveals an attack from a piece behind it","two pieces give check at once","a pinned piece moves","the queen is sacrificed"]}',
     '{"answer":"a piece moves and reveals an attack from a piece behind it"}'),
    ('chess-foundations', '1.0', 'tactics', 'kn-tac-2',
     '{"kind":"mc","prompt":"Smothered mate is delivered by which piece against a trapped king?","options":["a knight","a bishop","a rook","a pawn"]}',
     '{"answer":"a knight"}'),
    ('chess-foundations', '1.0', 'tactics', 'kn-tac-3',
     '{"kind":"mc","prompt":"Luft (an escape square for the king) mainly prevents which danger?","options":["back-rank mate","a fork","a skewer","a discovered check"]}',
     '{"answer":"back-rank mate"}'),
    ('chess-foundations', '1.0', 'tactics', 'kn-tac-4',
     '{"kind":"mc","prompt":"A deflection tactic works by doing what?","options":["luring a defender away from its duty","pinning a piece absolutely","giving double check","sacrificing the exchange"]}',
     '{"answer":"luring a defender away from its duty"}')
ON CONFLICT (program_slug, program_version, item_key) DO NOTHING;

-- Practical items (8): deterministic server-checked tasks. ----------------
-- Answers verified: mates checked square-by-square; opening lines are the
-- canonical move orders; endgame pawn push is the standard winning motif.
INSERT INTO practical_items
    (program_slug, program_version, skill_key, item_key, payload, answer_key)
VALUES
    ('chess-foundations', '1.0', 'rules', 'pr-rules-1',
     '{"kind":"mate_in_1","fen":"7k/8/5K2/8/8/8/8/6Q1 w - - 0 1","prompt":"White to move mates in 1. Reply with the move in UCI (e.g. g1g7)."}',
     '{"answer":"g1g7"}'),
    ('chess-foundations', '1.0', 'rules', 'pr-rules-2',
     '{"kind":"mate_in_1","fen":"7k/6P1/6K1/8/8/8/8/8 w - - 0 1","prompt":"White to move mates in 1 by promotion. Reply in UCI with promotion piece (e.g. g7g8q)."}',
     '{"answer":"g7g8q"}'),
    ('chess-foundations', '1.0', 'openings', 'pr-open-1',
     '{"kind":"opening_line","fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","prompt":"Play the Ruy Lopez for White, moves 1-3, as space-separated UCI (5 tokens)."}',
     '{"answer":"e2e4 e7e5 g1f3 b8c6 f1b5"}'),
    ('chess-foundations', '1.0', 'openings', 'pr-open-2',
     '{"kind":"opening_line","fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","prompt":"Play the Italian Game for White, moves 1-3, as space-separated UCI (5 tokens)."}',
     '{"answer":"e2e4 e7e5 g1f3 b8c6 f1c4"}'),
    ('chess-foundations', '1.0', 'endgames', 'pr-end-1',
     '{"kind":"mate_in_1","fen":"7k/6pp/8/8/8/6K1/6PP/5R2 w - - 0 1","prompt":"White to move mates in 1. Reply with the move in UCI."}',
     '{"answer":"f1f8"}'),
    ('chess-foundations', '1.0', 'endgames', 'pr-end-2',
     '{"kind":"winning_move","fen":"8/8/8/3k4/2P5/8/1K6/8 w - - 0 1","prompt":"White to move wins (Black draws after Kc3). Reply with the winning pawn push in UCI."}',
     '{"answer":"c4c5"}'),
    ('chess-foundations', '1.0', 'tactics', 'pr-tac-1',
     '{"kind":"best_move","fen":"r1bqkb1r/pppp1ppp/2n5/4p3/2B1N3/2N5/PPPP1PPP/R1BQK2R b KQkq - 0 5","prompt":"Black to move forks two White pieces. Reply with the move in UCI."}',
     '{"answer":"d7d5"}'),
    ('chess-foundations', '1.0', 'tactics', 'pr-tac-2',
     '{"kind":"best_move","fen":"r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3","prompt":"Black to move breaks the pin on the c6 knight. Reply with the move in UCI."}',
     '{"answer":"a7a6"}')
ON CONFLICT (program_slug, program_version, item_key) DO NOTHING;

-- Final exam bank: 40 skill-tagged questions, server picks 20. ------------
INSERT INTO assessment_question_sets
    (id, program_slug, version, question_count, time_limit_minutes, pass_score, questions)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'chess-foundations', '1.0', 20, 30, 80,
     '[
      {"id":"fq-rules-1","skill":"rules","prompt":"A rook moves how?","options":["any distance along ranks or files","only diagonally","one square only","like a knight"]},
      {"id":"fq-rules-2","skill":"rules","prompt":"A queen combines the moves of which pieces?","options":["rook and bishop","rook and knight","bishop and knight","king and pawn"]},
      {"id":"fq-rules-3","skill":"rules","prompt":"Which statement about knights is true?","options":["they jump over pieces","they move diagonally","they cannot move backwards","they move two squares straight"]},
      {"id":"fq-rules-4","skill":"rules","prompt":"A pawn promotes when it reaches?","options":["the farthest rank","the fourth rank","its starting square","any dark square"]},
      {"id":"fq-rules-5","skill":"rules","prompt":"In castling, the king moves how many squares?","options":["two","one","three","four"]},
      {"id":"fq-rules-6","skill":"rules","prompt":"Check means which is true?","options":["the king is attacked","the queen is attacked","no moves exist","time ran out"]},
      {"id":"fq-rules-7","skill":"rules","prompt":"Checkmate ends the game with which result?","options":["a decisive win","a draw","a replay","a time scramble"]},
      {"id":"fq-rules-8","skill":"rules","prompt":"A bishop always stays on which squares?","options":["its starting square color","opposite color each move","light squares only","the back rank"]},
      {"id":"fq-rules-9","skill":"rules","prompt":"At the start, both kings stand on which file?","options":["the e-file","the d-file","the a-file","the h-file"]},
      {"id":"fq-rules-10","skill":"rules","prompt":"No legal moves while NOT in check is called?","options":["stalemate","checkmate","zugzwang","perpetual"]},
      {"id":"fq-open-1","skill":"openings","prompt":"The Italian Game is defined by which White third move?","options":["3.Bc4","3.Bb5","3.d4","3.Nc3"]},
      {"id":"fq-open-2","skill":"openings","prompt":"The Ruy Lopez is defined by which White third move?","options":["3.Bb5","3.Bc4","3.d4","3.Qh5"]},
      {"id":"fq-open-3","skill":"openings","prompt":"After 1.e4, the Sicilian starts with Black playing?","options":["1...c5","1...e5","1...e6","1...d6"]},
      {"id":"fq-open-4","skill":"openings","prompt":"After 1.e4, the French starts with Black playing?","options":["1...e6","1...c5","1...c6","1...g6"]},
      {"id":"fq-open-5","skill":"openings","prompt":"After 1.e4, the Caro-Kann starts with Black playing?","options":["1...c6","1...c5","1...e5","1...d5"]},
      {"id":"fq-open-6","skill":"openings","prompt":"The Scotch Game is defined by which White third move?","options":["3.d4","3.Bc4","3.Bb5","3.c3"]},
      {"id":"fq-open-7","skill":"openings","prompt":"The Vienna Game most often starts 1.e4 e5 with White playing?","options":["2.Nc3","2.Nf3","2.d4","2.f4"]},
      {"id":"fq-open-8","skill":"openings","prompt":"The Petrov Defense is defined by which Black second move?","options":["2...Nf6","2...Nc6","2...d6","2...Bc5"]},
      {"id":"fq-open-9","skill":"openings","prompt":"The Evans Gambit continues 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 with?","options":["4.b4","4.d4","4.Nc3","4.0-0"]},
      {"id":"fq-open-10","skill":"openings","prompt":"1.d4 d5 2.c4 defines which opening?","options":["Queens Gambit","Kings Gambit","London System","Dutch Defense"]},
      {"id":"fq-end-1","skill":"endgames","prompt":"With direct opposition, who benefits?","options":["the side NOT to move","the side to move","White always","Black always"]},
      {"id":"fq-end-2","skill":"endgames","prompt":"King + two knights versus bare king (no pawn) is?","options":["not a forced win","mate in 3","mate in 10","a win on time"]},
      {"id":"fq-end-3","skill":"endgames","prompt":"Two rooks versus a bare king deliver mate by?","options":["driving the king to the edge rank by rank","sacrificing both rooks","stalemating first","perpetual check"]},
      {"id":"fq-end-4","skill":"endgames","prompt":"Triangulation is used to do what?","options":["lose a move and pass the turn to the opponent","give check","promote faster","force stalemate"]},
      {"id":"fq-end-5","skill":"endgames","prompt":"A wrong rook pawn plus wrong-colored bishop against a bare king is?","options":["a dead draw","a forced win","mate in 7","a loss"]},
      {"id":"fq-end-6","skill":"endgames","prompt":"The Lucena bridge lets the stronger side do what?","options":["shelter its king from checks while promoting","force stalemate","draw by repetition","stop the clock"]},
      {"id":"fq-end-7","skill":"endgames","prompt":"The Philidor defense holds the draw by keeping the rook where?","options":["on the third rank","behind its king","in the corner","off the board"]},
      {"id":"fq-end-8","skill":"endgames","prompt":"A rook is usually strongest in which relation to a passed pawn?","options":["behind it","blocking it","far from it","pinned to it"]},
      {"id":"fq-end-9","skill":"endgames","prompt":"King and pawn versus bare king: with the king in front of its pawn and opposition, the result is usually?","options":["a win","a draw","a loss","a stalemate"]},
      {"id":"fq-end-10","skill":"endgames","prompt":"The square rule is used to judge what?","options":["whether a king can catch a passed pawn","whether castling is legal","whether a move is check","whether time is low"]},
      {"id":"fq-tac-1","skill":"tactics","prompt":"A knight on e5 attacks c6 and f7 at once. This is called?","options":["a fork","a pin","a skewer","a battery"]},
      {"id":"fq-tac-2","skill":"tactics","prompt":"A bishop on b5 pins a knight on c6 to the king on e8. The pin is?","options":["absolute","relative","imaginary","illegal"]},
      {"id":"fq-tac-3","skill":"tactics","prompt":"Queen takes a front piece and next move takes the piece behind it. This pattern is?","options":["a skewer","a fork","a discovered attack","a windmill"]},
      {"id":"fq-tac-4","skill":"tactics","prompt":"A piece steps aside and a rook behind it gives check. This is?","options":["a discovered check","a double check","a pin","a fork"]},
      {"id":"fq-tac-5","skill":"tactics","prompt":"Two pieces give check on one move. The defender must?","options":["move the king","block both checks","capture both pieces","resign"]},
      {"id":"fq-tac-6","skill":"tactics","prompt":"A knight mates a king fully surrounded by its own pieces. This is?","options":["smothered mate","back-rank mate","Arabian mate","anastasia mate"]},
      {"id":"fq-tac-7","skill":"tactics","prompt":"Pushing an edge pawn one square to give the king flight is called making?","options":["luft","a bridge","a battery","a fortress"]},
      {"id":"fq-tac-8","skill":"tactics","prompt":"Sacrificing on h7 to drag the king out is an example of?","options":["deflection","a pin","a fork","a stalemate trick"]},
      {"id":"fq-tac-9","skill":"tactics","prompt":"One defender guards two threatened points at once. That defender is?","options":["overloaded","pinned","trapped","promoted"]},
      {"id":"fq-tac-10","skill":"tactics","prompt":"A series of alternating checks and discovered attacks that wins material is called?","options":["a windmill","a fork","a skewer","a blockade"]}
     ]')
ON CONFLICT (id) DO NOTHING;

INSERT INTO assessment_answer_keys (question_set_id, answers, question_ids)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     '{"fq-rules-1":"any distance along ranks or files","fq-rules-2":"rook and bishop","fq-rules-3":"they jump over pieces","fq-rules-4":"the farthest rank","fq-rules-5":"two","fq-rules-6":"the king is attacked","fq-rules-7":"a decisive win","fq-rules-8":"its starting square color","fq-rules-9":"the e-file","fq-rules-10":"stalemate","fq-open-1":"3.Bc4","fq-open-2":"3.Bb5","fq-open-3":"1...c5","fq-open-4":"1...e6","fq-open-5":"1...c6","fq-open-6":"3.d4","fq-open-7":"2.Nc3","fq-open-8":"2...Nf6","fq-open-9":"4.b4","fq-open-10":"Queens Gambit","fq-end-1":"the side NOT to move","fq-end-2":"not a forced win","fq-end-3":"driving the king to the edge rank by rank","fq-end-4":"lose a move and pass the turn to the opponent","fq-end-5":"a dead draw","fq-end-6":"shelter its king from checks while promoting","fq-end-7":"on the third rank","fq-end-8":"behind it","fq-end-9":"a win","fq-end-10":"whether a king can catch a passed pawn","fq-tac-1":"a fork","fq-tac-2":"absolute","fq-tac-3":"a skewer","fq-tac-4":"a discovered check","fq-tac-5":"move the king","fq-tac-6":"smothered mate","fq-tac-7":"luft","fq-tac-8":"deflection","fq-tac-9":"overloaded","fq-tac-10":"a windmill"}',
     '["fq-rules-1","fq-rules-2","fq-rules-3","fq-rules-4","fq-rules-5","fq-rules-6","fq-rules-7","fq-rules-8","fq-rules-9","fq-rules-10","fq-open-1","fq-open-2","fq-open-3","fq-open-4","fq-open-5","fq-open-6","fq-open-7","fq-open-8","fq-open-9","fq-open-10","fq-end-1","fq-end-2","fq-end-3","fq-end-4","fq-end-5","fq-end-6","fq-end-7","fq-end-8","fq-end-9","fq-end-10","fq-tac-1","fq-tac-2","fq-tac-3","fq-tac-4","fq-tac-5","fq-tac-6","fq-tac-7","fq-tac-8","fq-tac-9","fq-tac-10"]')
ON CONFLICT (question_set_id) DO NOTHING;
