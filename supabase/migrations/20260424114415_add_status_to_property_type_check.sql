-- Add 'status' to the allowed property types for database_properties.
-- The original CHECK constraint omitted 'status', causing inserts to fail.

alter table public.database_properties
  drop constraint database_properties_type_check;

alter table public.database_properties
  add constraint database_properties_type_check
  check (type in (
    'text', 'number', 'select', 'multi_select', 'status', 'checkbox', 'date',
    'url', 'email', 'phone', 'person', 'files', 'relation', 'formula',
    'created_time', 'updated_time', 'created_by'
  ));
