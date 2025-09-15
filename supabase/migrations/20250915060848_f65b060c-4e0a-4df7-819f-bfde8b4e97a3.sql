-- Enable leaked password protection
UPDATE auth.config 
SET password_protection_enabled = true
WHERE instance_id = (SELECT uuid_generate_v4());

-- Note: Postgres version upgrade needs to be done manually via Supabase dashboard