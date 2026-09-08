-- =============================================================================
-- Supabase Storage buckets for patient file uploads (Phase 6)
--
-- Run once in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to re-run: uses ON CONFLICT / IF NOT EXISTS patterns where possible.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'patient-documents',
    'patient-documents',
    true,
    10485760, -- 10 MB
    array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  ),
  (
    'patient-lab-results',
    'patient-lab-results',
    true,
    10485760, -- 10 MB
    array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS is always on for storage.objects. Allow authenticated users to
-- upload/read/delete within these two buckets.
-- Table RLS is separate — run supabase/rls.sql for patients/bookings/etc.

drop policy if exists "patient_documents_insert_authenticated" on storage.objects;
create policy "patient_documents_insert_authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'patient-documents');

drop policy if exists "patient_documents_select_authenticated" on storage.objects;
create policy "patient_documents_select_authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'patient-documents');

drop policy if exists "patient_documents_select_public" on storage.objects;
create policy "patient_documents_select_public"
  on storage.objects for select to public
  using (bucket_id = 'patient-documents');

drop policy if exists "patient_documents_delete_authenticated" on storage.objects;
create policy "patient_documents_delete_authenticated"
  on storage.objects for delete to authenticated
  using (bucket_id = 'patient-documents');

drop policy if exists "patient_lab_results_insert_authenticated" on storage.objects;
create policy "patient_lab_results_insert_authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'patient-lab-results');

drop policy if exists "patient_lab_results_select_authenticated" on storage.objects;
create policy "patient_lab_results_select_authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'patient-lab-results');

drop policy if exists "patient_lab_results_select_public" on storage.objects;
create policy "patient_lab_results_select_public"
  on storage.objects for select to public
  using (bucket_id = 'patient-lab-results');

drop policy if exists "patient_lab_results_delete_authenticated" on storage.objects;
create policy "patient_lab_results_delete_authenticated"
  on storage.objects for delete to authenticated
  using (bucket_id = 'patient-lab-results');
