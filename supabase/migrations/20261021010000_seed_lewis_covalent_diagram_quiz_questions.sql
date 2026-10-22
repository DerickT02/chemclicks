-- Seed covalent quiz questions that show the live molecule diagram.
-- Each diagram_key matches an id in src/lib/chemistry/covalent-compounds.ts.
-- Safe to re-run: the stable key is updated rather than duplicated.
-- Apply 20261021000000_quiz_question_diagrams.sql first.

begin;

insert into public.quiz_questions
  (quiz_key, question_key, question, options, correct_index, order_index, diagram_key)
values
    (
      'lewis_covalent',
      'lewis-diagram-h2-bond-order',
      'Which type of covalent bond is shown between the two hydrogen atoms?',
      '["Single bond","Double bond","Triple bond","Ionic bond"]'::jsonb,
      0,
      29,
      'h2'
    ),
    (
      'lewis_covalent',
      'lewis-diagram-h2-shared-pairs',
      'How many shared electron pairs are shown in this hydrogen molecule?',
      '["1","2","3","4"]'::jsonb,
      0,
      30,
      'h2'
    ),
    (
      'lewis_covalent',
      'lewis-diagram-o2-bond-order',
      'Which type of covalent bond is shown between the two oxygen atoms?',
      '["Single bond","Double bond","Triple bond","Ionic bond"]'::jsonb,
      1,
      31,
      'o2'
    ),
    (
      'lewis_covalent',
      'lewis-diagram-co2-bond-order',
      'What type of bond connects carbon to each oxygen atom in this molecule?',
      '["Single bond","Double bond","Triple bond","Ionic bond"]'::jsonb,
      1,
      32,
      'co2'
    ),
    (
      'lewis_covalent',
      'lewis-diagram-n2-bond-order',
      'Which type of covalent bond is shown between the two nitrogen atoms?',
      '["Single bond","Double bond","Triple bond","Ionic bond"]'::jsonb,
      2,
      33,
      'n2'
    ),
    (
      'lewis_covalent',
      'lewis-diagram-n2-shared-electrons',
      'How many electrons are in the shared pairs between the two nitrogen atoms?',
      '["2","4","6","8"]'::jsonb,
      2,
      34,
      'n2'
    ),
    (
      'lewis_covalent',
      'lewis-diagram-h2o-bond-count',
      'How many single covalent bonds are shown in this water molecule?',
      '["1","2","3","4"]'::jsonb,
      1,
      35,
      'h2o'
    ),
    (
      'lewis_covalent',
      'lewis-diagram-co2-shared-pairs',
      'How many shared electron pairs are shown in all the bonds of this carbon dioxide molecule?',
      '["2","3","4","6"]'::jsonb,
      2,
      36,
      'co2'
    )
on conflict (quiz_key, question_key) do update
set question = excluded.question,
    options = excluded.options,
    correct_index = excluded.correct_index,
    order_index = excluded.order_index,
    diagram_key = excluded.diagram_key,
    is_active = true;

commit;
