-- Drop tables first (CASCADE will handle triggers and dependencies)
DROP TABLE IF EXISTS public.attendance_records CASCADE;
DROP TABLE IF EXISTS public.attendance_policies CASCADE;
DROP TABLE IF EXISTS public.leave_applications CASCADE;
DROP TABLE IF EXISTS public.leave_balances CASCADE;

-- Drop functions (CASCADE to handle any remaining dependencies)
DROP FUNCTION IF EXISTS public.calculate_attendance_hours() CASCADE;
DROP FUNCTION IF EXISTS public.initialize_leave_balance() CASCADE;
DROP FUNCTION IF EXISTS public.update_leave_balance() CASCADE;

-- Drop enums
DROP TYPE IF EXISTS public.leave_status CASCADE;
DROP TYPE IF EXISTS public.leave_type CASCADE;

-- Storage bucket 'attendance-photos' removed via Storage API (not via direct SQL)