-- A graduated cylinder activity read to the nearest whole milliliter, alongside
-- the existing measurement_graduated_cylinder activity (tenths of a milliliter).
--
-- Postgres cannot use an enum value in the transaction that adds it, so the
-- catalog row and quiz support follow in 20261025000100_cylinder_whole_quiz.sql.
-- Apply this file first.

ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'measurement_graduated_cylinder_whole';
