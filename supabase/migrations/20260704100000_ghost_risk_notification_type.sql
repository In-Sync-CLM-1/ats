-- Ghosting watchdog: allow the ghost_risk notification type.
-- Idempotent so it applies cleanly whether run by CI db push or the management API.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_notification_type_check
  CHECK (notification_type = ANY (ARRAY[
    'task_assigned'::text,
    'due_soon'::text,
    'overdue'::text,
    'ghost_risk'::text
  ]));
