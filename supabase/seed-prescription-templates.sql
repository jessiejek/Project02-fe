-- Seed multiple prescription templates (+ line items) for the active doctor.
-- Run in Supabase SQL Editor (bypasses RLS).
-- Uses doctor@clinic.test by default — change the email if needed.
--
-- Safe to re-run: skips templates whose title already exists for that doctor.

-- 1) Ensure starter formulary exists
insert into public.medicines (generic_name)
values
  ('PARACETAMOL 500MG TAB'),
  ('AMOXICILLIN + CLAVULANIC ACID (CO-AMOXICLAV) 500MG TAB'),
  ('CEFIXIME 200MG TAB'),
  ('LOPERAMIDE 2MG CAP'),
  ('MEFENAMIC ACID 500MG TAB'),
  ('CETIRIZINE 10MG TAB'),
  ('OMEPRAZOLE 20MG CAP'),
  ('METFORMIN 500MG TAB'),
  ('LOSARTAN 50MG TAB'),
  ('ASCORBIC ACID + MULTIVITAMINS 500MG TAB'),
  ('SALBUTAMOL 2MG/5ML SYRUP'),
  ('AMLODIPINE 5MG TAB'),
  ('AZITHROMYCIN 500MG TAB'),
  ('IBUPROFEN 400MG TAB'),
  ('SIMVASTATIN 20MG TAB')
on conflict (generic_name) do nothing;

-- 2) Insert templates + items
with doc as (
  select d.doctor_id
  from public.doctors d
  join public.staff_accounts s on s.staff_id = d.doctor_id
  where s.email = 'doctor@clinic.test'
  limit 1
),
tpl_defs (title, is_system_template) as (
  values
    ('Medical Certificate', true),
    ('URTI Standard', false),
    ('Hypertension Bundle', false),
    ('Type 2 Diabetes Bundle', false),
    ('Acute Gastroenteritis', false),
    ('Pain / Fever Supportive', false)
),
new_tpls as (
  insert into public.prescription_templates (doctor_id, title, is_system_template)
  select
    doc.doctor_id,
    d.title,
    d.is_system_template
  from doc
  cross join tpl_defs d
  where exists (select 1 from doc)
    and not exists (
      select 1
      from public.prescription_templates existing
      where existing.doctor_id = (select doctor_id from doc)
        and existing.title = d.title
    )
  returning template_id, title
),
item_defs (template_title, generic_name, dosage, quantity, instruction) as (
  values
    ('Medical Certificate', 'PARACETAMOL 500MG TAB', '2', '10', 'After Meal as needed for fever'),

    ('URTI Standard', 'AZITHROMYCIN 500MG TAB', '1', '3', 'Once daily after meal'),
    ('URTI Standard', 'CETIRIZINE 10MG TAB', '1', '7', 'Once daily at bedtime'),

    ('Hypertension Bundle', 'LOSARTAN 50MG TAB', '1', '30', 'Once daily'),
    ('Hypertension Bundle', 'AMLODIPINE 5MG TAB', '1', '30', 'Once daily'),

    ('Type 2 Diabetes Bundle', 'METFORMIN 500MG TAB', '1', '60', 'Twice daily after meals'),
    ('Type 2 Diabetes Bundle', 'SIMVASTATIN 20MG TAB', '1', '30', 'Once daily at bedtime'),

    ('Acute Gastroenteritis', 'LOPERAMIDE 2MG CAP', '1', '10', 'After each loose stool, max 4 caps/day'),
    ('Acute Gastroenteritis', 'OMEPRAZOLE 20MG CAP', '1', '14', 'Once daily before breakfast'),

    ('Pain / Fever Supportive', 'PARACETAMOL 500MG TAB', '1-2', '20', 'Every 6 hours as needed for pain/fever'),
    ('Pain / Fever Supportive', 'IBUPROFEN 400MG TAB', '1', '15', 'Every 8 hours after meals as needed for pain'),
    ('Pain / Fever Supportive', 'MEFENAMIC ACID 500MG TAB', '1', '10', 'Every 8 hours after meals as needed for pain')
),
ins_items as (
  insert into public.prescription_template_items (
    template_id,
    medicine_id,
    generic_name,
    dosage,
    quantity,
    instruction,
    is_controlled_substance
  )
  select
    nt.template_id,
    m.medicine_id,
    m.generic_name,
    i.dosage,
    i.quantity,
    i.instruction,
    false
  from new_tpls nt
  join item_defs i on i.template_title = nt.title
  join public.medicines m on m.generic_name = i.generic_name
  returning id
)
select
  (select count(*) from new_tpls) as templates_created,
  (select count(*) from ins_items) as items_created;

-- 3) Verify
select
  t.title,
  t.is_system_template,
  count(i.id) as item_count,
  string_agg(i.generic_name, ' · ' order by i.generic_name) as medicines
from public.prescription_templates t
left join public.prescription_template_items i on i.template_id = t.template_id
group by t.template_id, t.title, t.is_system_template
order by t.is_system_template desc, t.title;
