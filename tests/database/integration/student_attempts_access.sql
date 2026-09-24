-- Run as postgres in the SQL editor, psql, or Supabase execute_sql.
-- All fixtures (including Auth users) are rolled back. No existing rows changed.
BEGIN;
DO $$
DECLARE
  ta uuid := gen_random_uuid(); tb uuid := gen_random_uuid(); stranger uuid := gen_random_uuid();
  ca uuid; cb uuid; act uuid; aa uuid; ab uuid; sa uuid; sb uuid; pa uuid; pb uuid; mismatch uuid;
  attempt uuid; n integer; tbl text; op text;
BEGIN
  INSERT INTO auth.users(id,email,email_confirmed_at)
    VALUES(ta,ta||'@example.invalid',now()),(tb,tb||'@example.invalid',now()),(stranger,stranger||'@example.invalid',now());
  INSERT INTO public.teachers(id,email,display_name)
    VALUES(ta,ta||'@example.invalid','Test A'),(tb,tb||'@example.invalid','Test B');
  SELECT id INTO act FROM public.activities WHERE type::text='lewis_diagram' LIMIT 1;
  IF act IS NULL THEN RAISE EXCEPTION 'An activity fixture anchor is required'; END IF;
  INSERT INTO public.classes(teacher_id,name,section,class_code) VALUES(ta,'Access test A','Test',upper(substr(md5(ta::text),1,6))) RETURNING id INTO ca;
  INSERT INTO public.classes(teacher_id,name,section,class_code) VALUES(tb,'Access test B','Test',upper(substr(md5(tb::text),1,6))) RETURNING id INTO cb;
  INSERT INTO public.class_activities(class_id,activity_id) VALUES(ca,act) RETURNING id INTO aa;
  INSERT INTO public.class_activities(class_id,activity_id) VALUES(cb,act) RETURNING id INTO ab;
  INSERT INTO public.students(class_id,first_name,last_name,student_id,verified) VALUES(ca,'Test','A',gen_random_uuid()::text,true) RETURNING id INTO sa;
  INSERT INTO public.students(class_id,first_name,last_name,student_id,verified) VALUES(cb,'Test','B',gen_random_uuid()::text,true) RETURNING id INTO sb;
  INSERT INTO public.student_progress(student_id,class_activity_id) VALUES(sa,aa) RETURNING id INTO pa;
  INSERT INTO public.student_progress(student_id,class_activity_id) VALUES(sb,ab) RETURNING id INTO pb;
  INSERT INTO public.student_progress(student_id,class_activity_id) VALUES(sa,ab) RETURNING id INTO mismatch;

  SET LOCAL ROLE service_role;
  SELECT id INTO attempt FROM public.student_attempt_access(sa,ca,pa,true);
  IF attempt IS NULL THEN RAISE EXCEPTION 'Student own create failed'; END IF;
  SELECT count(*) INTO n FROM public.student_attempt_access(sa,ca,pa,false);
  IF n<>1 THEN RAISE EXCEPTION 'Student own read failed'; END IF;
  PERFORM public.student_attempt_access(sb,cb,pb,true);
  BEGIN PERFORM public.student_attempt_access(sa,ca,pb,false); RAISE EXCEPTION 'Student other read allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.student_attempt_access(sa,ca,pb,true); RAISE EXCEPTION 'Student other create allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.student_attempt_access(sa,cb,pa,false); RAISE EXCEPTION 'Forged class allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.student_attempt_access(sa,ca,mismatch,true); RAISE EXCEPTION 'Cross-class progress allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;

  UPDATE public.students SET verified=false WHERE id=sa;
  SET LOCAL ROLE service_role;
  BEGIN PERFORM public.student_attempt_access(sa,ca,pa,true); RAISE EXCEPTION 'Unverified student allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  UPDATE public.students SET verified=true WHERE id=sa;
  UPDATE public.classes SET is_active=false WHERE id=ca;
  SET LOCAL ROLE service_role;
  BEGIN PERFORM public.student_attempt_access(sa,ca,pa,false); RAISE EXCEPTION 'Inactive class allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  UPDATE public.classes SET is_active=true WHERE id=ca;

  PERFORM set_config('request.jwt.claims',json_build_object('sub',ta,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.student_attempts WHERE progress_id IN(pa,pb);
  IF n<>1 OR NOT EXISTS(SELECT 1 FROM public.student_attempts WHERE id=attempt) THEN RAISE EXCEPTION 'Teacher own/other isolation failed'; END IF;
  BEGIN PERFORM public.student_attempt_access(sa,ca,pa,false); RAISE EXCEPTION 'Browser invoked student RPC'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE public.classes SET teacher_id=ta WHERE id=cb; RAISE EXCEPTION 'Class takeover allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN DELETE FROM public.classes WHERE id=cb; RAISE EXCEPTION 'Parent cascade allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE public.student_attempts SET score=100 WHERE id=attempt; RAISE EXCEPTION 'History update allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN DELETE FROM public.student_attempts WHERE id=attempt; RAISE EXCEPTION 'History delete allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.student_attempts(progress_id,attempt_number) VALUES(pa,99); RAISE EXCEPTION 'Direct create allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims',json_build_object('sub',tb,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.student_attempts WHERE progress_id IN(pa,pb);
  IF n<>1 OR EXISTS(SELECT 1 FROM public.student_attempts WHERE id=attempt) THEN RAISE EXCEPTION 'Teacher B isolation failed'; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',stranger,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  IF EXISTS(SELECT 1 FROM public.student_attempts WHERE progress_id IN(pa,pb)) THEN RAISE EXCEPTION 'Unrelated user can read'; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
  SET LOCAL ROLE anon;
  IF EXISTS(SELECT 1 FROM public.student_attempts WHERE progress_id IN(pa,pb)) THEN RAISE EXCEPTION 'Anonymous can read'; END IF;
  BEGIN PERFORM public.student_attempt_access(sa,ca,pa,true); RAISE EXCEPTION 'Anonymous invoked RPC'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;

  FOREACH tbl IN ARRAY ARRAY['classes','teachers','student_attempts','students','student_progress','class_activities','activities'] LOOP
    FOREACH op IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      IF has_table_privilege('anon','public.'||tbl,op) OR has_table_privilege('authenticated','public.'||tbl,op) THEN RAISE EXCEPTION 'Unexpected % grant on %',op,tbl; END IF;
    END LOOP;
  END LOOP;
  IF (SELECT relrowsecurity FROM pg_class WHERE oid='public.classes'::regclass)
    OR (SELECT relrowsecurity FROM pg_class WHERE oid='public.teachers'::regclass)
    OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.student_attempts'::regclass)
    THEN RAISE EXCEPTION 'Unexpected RLS state'; END IF;
END $$;
SELECT 'PASS: student own/other, teacher own/other, anonymous, unrelated, enrollment, unauthorized writes and RLS state' AS result;
ROLLBACK;
