-- Seed multiple SOAP templates for the active doctor account.
-- Run in Supabase SQL Editor (bypasses RLS).
-- Uses doctor@clinic.test by default — change the email if needed.

with doc as (
  select d.doctor_id
  from public.doctors d
  join public.staff_accounts s on s.staff_id = d.doctor_id
  where s.email = 'doctor@clinic.test'
  limit 1
)
insert into public.soap_templates (
  doctor_id,
  title,
  is_system_template,
  chief_complaint,
  subjective,
  objective,
  assessment,
  plan
)
select
  doc.doctor_id,
  t.title,
  t.is_system_template,
  t.chief_complaint,
  t.subjective,
  t.objective,
  t.assessment,
  t.plan
from doc
cross join (
  values
    (
      'Annual Physical — Normal',
      true,
      'Annual physical examination.',
      'Patient reports feeling well, no new complaints.',
      'Vitals within normal range. Alert and oriented, no acute distress. Heart regular rate and rhythm. Lungs clear bilaterally.',
      'Healthy, age-appropriate.',
      'Continue routine health maintenance. Return in 1 year or sooner if concerns arise.'
    ),
    (
      'URTI Follow-up',
      false,
      'Follow-up for upper respiratory infection.',
      'Patient reports improvement in symptoms since last visit.',
      'No fever. Throat clear, no erythema. Lungs clear bilaterally.',
      'Upper respiratory infection, resolving.',
      'Complete remaining course of antibiotics if prescribed. Return if symptoms worsen or fail to resolve.'
    ),
    (
      'Hypertension Follow-up',
      false,
      'Follow-up for hypertension.',
      'Patient reports adherence to medications. Occasional headaches. No chest pain or dyspnea.',
      'BP elevated/controlled as recorded. Heart regular. No pedal edema. Lungs clear.',
      'Essential hypertension — follow-up.',
      'Continue current antihypertensives. Lifestyle counseling. Recheck BP in clinic; return sooner if symptoms.'
    ),
    (
      'Diabetes Mellitus Follow-up',
      false,
      'Follow-up for diabetes mellitus.',
      'Patient reports home glucose monitoring. Diet mostly followed. No polyuria or polydipsia currently.',
      'Alert, no acute distress. No foot ulcers. Sensation intact on exam.',
      'Type 2 diabetes mellitus — follow-up.',
      'Continue current regimen. Review labs (HbA1c, lipids, creatinine). Reinforce diet/exercise. Follow-up as scheduled.'
    ),
    (
      'Acute Gastroenteritis',
      false,
      'Vomiting and diarrhea.',
      'Onset of watery stools and vomiting. Able to tolerate sips. No bloody stools reported.',
      'Mild dehydration signs as noted. Abdomen soft, non-tender. Bowel sounds present.',
      'Acute gastroenteritis.',
      'Oral rehydration. Antiemetic/antidiarrheal as indicated. Return if unable to keep fluids, high fever, or bloody stools.'
    ),
    (
      'Well Child / Pediatric Check',
      true,
      'Routine well-child visit.',
      'Parents report child is active and eating well. No recent illness.',
      'Growth parameters reviewed. HEENT normal. Heart and lungs clear. Abdomen soft. Development appropriate for age.',
      'Healthy child — well visit.',
      'Continue age-appropriate vaccines/nutrition counseling. Return for next scheduled well visit or sooner if concerns.'
    )
) as t(
  title,
  is_system_template,
  chief_complaint,
  subjective,
  objective,
  assessment,
  plan
)
where exists (select 1 from doc)
  and not exists (
    select 1
    from public.soap_templates existing
    where existing.doctor_id = (select doctor_id from doc)
      and existing.title = t.title
  );

-- Verify
select title, is_system_template, left(chief_complaint, 40) as chief_complaint
from public.soap_templates
order by is_system_template desc, title;
