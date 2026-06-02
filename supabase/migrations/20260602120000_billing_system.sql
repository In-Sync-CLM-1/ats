-- ============================================================================
-- Billing & per-tenant enforcement system (replicated from globalcrm)
-- Standardizes ats onto the single-org tenancy model + adds wallet/subscription
-- /Razorpay/offline billing with lock cascade. ats is greenfield (no live tenants).
-- ============================================================================
-- PART A — organizations billing columns + internal-org exemption switch
-- ============================================================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS services_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS subscription_active boolean NOT NULL DEFAULT false;

-- ============================================================================

-- ============================================================================
-- PART B — billing tables, indexes, FKs, RLS enable (from globalcrm)
-- ============================================================================
--
--

\restrict 24N2FKh1r3OIQRBZt8WsDfoFB6taGva4UhdRq70yaQDzk6w64N2ORAI4nZDfJLK





--
-- Name: organization_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_settings (
    org_id uuid NOT NULL,
    dialing_active boolean DEFAULT false NOT NULL,
    calling_windows jsonb DEFAULT '[]'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    demo_meeting_link text,
    demo_host_user_id uuid,
    act_today_only boolean DEFAULT false NOT NULL,
    enforce_wallet_in_trial boolean DEFAULT false NOT NULL,
    demo_reminder_agent_id text,
    allow_low_recharge boolean DEFAULT false NOT NULL
);


--
-- Name: organization_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    subscription_status text DEFAULT 'active'::text NOT NULL,
    billing_cycle_start date NOT NULL,
    next_billing_date date NOT NULL,
    last_payment_date date,
    user_count integer DEFAULT 0 NOT NULL,
    monthly_subscription_amount numeric DEFAULT 0 NOT NULL,
    wallet_balance numeric DEFAULT 0 NOT NULL,
    wallet_minimum_balance numeric DEFAULT 500 NOT NULL,
    wallet_last_topup_date timestamp with time zone,
    wallet_auto_topup_enabled boolean DEFAULT true,
    suspension_date timestamp with time zone,
    suspension_reason text,
    grace_period_end date,
    readonly_period_end date,
    lockout_date date,
    suspension_override_until date,
    override_reason text,
    override_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    one_time_setup_fee numeric DEFAULT 0,
    billing_period text DEFAULT 'quarterly'::text NOT NULL,
    wallet_alert_level text DEFAULT 'none'::text NOT NULL,
    wallet_alert_sent_at timestamp with time zone,
    wallet_low_alert_threshold numeric DEFAULT 5000 NOT NULL,
    CONSTRAINT organization_subscriptions_billing_period_chk CHECK ((billing_period = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'annual'::text]))),
    CONSTRAINT organization_subscriptions_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['active'::text, 'suspended_grace'::text, 'suspended_readonly'::text, 'suspended_locked'::text, 'cancelled'::text])))
);


--
-- Name: COLUMN organization_subscriptions.one_time_setup_fee; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organization_subscriptions.one_time_setup_fee IS 'One-time setup fee charged when subscription is created';


--
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    invoice_id uuid,
    transaction_type text NOT NULL,
    amount numeric NOT NULL,
    razorpay_order_id text,
    razorpay_payment_id text,
    razorpay_signature text,
    payment_status text DEFAULT 'initiated'::text NOT NULL,
    payment_method text,
    initiated_by uuid,
    initiated_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    failure_reason text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payment_transactions_payment_status_check CHECK ((payment_status = ANY (ARRAY['initiated'::text, 'processing'::text, 'success'::text, 'failed'::text, 'refunded'::text]))),
    CONSTRAINT payment_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['subscription_payment'::text, 'wallet_topup'::text, 'wallet_auto_topup'::text, 'refund'::text])))
);


--
-- Name: service_usage_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_usage_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    service_type text NOT NULL,
    reference_id uuid NOT NULL,
    user_id uuid,
    quantity numeric NOT NULL,
    cost numeric NOT NULL,
    wallet_deducted boolean DEFAULT false,
    wallet_transaction_id uuid,
    deduction_error text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT service_usage_logs_service_type_check CHECK ((service_type = ANY (ARRAY['email'::text, 'whatsapp'::text, 'call'::text])))
);


--
-- Name: subscription_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    invoice_number text NOT NULL,
    invoice_date date NOT NULL,
    due_date date NOT NULL,
    billing_period_start date NOT NULL,
    billing_period_end date NOT NULL,
    setup_fee numeric DEFAULT 0,
    base_subscription_amount numeric NOT NULL,
    user_count integer NOT NULL,
    prorated_amount numeric DEFAULT 0,
    subtotal numeric NOT NULL,
    gst_amount numeric NOT NULL,
    total_amount numeric NOT NULL,
    paid_amount numeric DEFAULT 0,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    paid_at timestamp with time zone,
    waived_by uuid,
    waive_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT subscription_invoices_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'partially_paid'::text, 'overdue'::text, 'waived'::text, 'cancelled'::text])))
);


--
-- Name: subscription_pricing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_pricing (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    one_time_setup_cost numeric DEFAULT 2000 NOT NULL,
    per_user_monthly_cost numeric DEFAULT 500 NOT NULL,
    min_wallet_balance numeric DEFAULT 5000 NOT NULL,
    email_cost_per_unit numeric DEFAULT 1 NOT NULL,
    whatsapp_cost_per_unit numeric DEFAULT 0.50 NOT NULL,
    call_cost_per_minute numeric DEFAULT 2 NOT NULL,
    call_cost_per_call numeric,
    auto_topup_amount numeric DEFAULT 5000 NOT NULL,
    auto_topup_enabled boolean DEFAULT true,
    gst_percentage numeric DEFAULT 18 NOT NULL,
    is_active boolean DEFAULT false,
    effective_from timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: wallet_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    transaction_type text NOT NULL,
    amount numeric NOT NULL,
    balance_before numeric NOT NULL,
    balance_after numeric NOT NULL,
    reference_id uuid,
    reference_type text,
    quantity integer,
    unit_cost numeric,
    payment_transaction_id uuid,
    description text,
    created_by uuid,
    admin_reason text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT wallet_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['topup'::text, 'auto_topup'::text, 'deduction_email'::text, 'deduction_whatsapp'::text, 'deduction_call'::text, 'refund'::text, 'admin_adjustment'::text])))
);


--
-- Name: organization_settings organization_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_pkey PRIMARY KEY (org_id);


--
-- Name: organization_subscriptions organization_subscriptions_org_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_subscriptions
    ADD CONSTRAINT organization_subscriptions_org_id_key UNIQUE (org_id);


--
-- Name: organization_subscriptions organization_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_subscriptions
    ADD CONSTRAINT organization_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- Name: service_usage_logs service_usage_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_usage_logs
    ADD CONSTRAINT service_usage_logs_pkey PRIMARY KEY (id);


--
-- Name: subscription_invoices subscription_invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_invoices
    ADD CONSTRAINT subscription_invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: subscription_invoices subscription_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_invoices
    ADD CONSTRAINT subscription_invoices_pkey PRIMARY KEY (id);


--
-- Name: subscription_pricing subscription_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_pricing
    ADD CONSTRAINT subscription_pricing_pkey PRIMARY KEY (id);


--
-- Name: wallet_transactions wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);


--
-- Name: idx_invoices_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_due_date ON public.subscription_invoices USING btree (due_date);


--
-- Name: idx_invoices_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_number ON public.subscription_invoices USING btree (invoice_number);


--
-- Name: idx_invoices_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_org ON public.subscription_invoices USING btree (org_id);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_status ON public.subscription_invoices USING btree (payment_status);


--
-- Name: idx_org_subs_billing_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_subs_billing_date ON public.organization_subscriptions USING btree (next_billing_date);


--
-- Name: idx_org_subs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_subs_org ON public.organization_subscriptions USING btree (org_id);


--
-- Name: idx_org_subs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_subs_status ON public.organization_subscriptions USING btree (subscription_status);


--
-- Name: idx_payments_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_invoice ON public.payment_transactions USING btree (invoice_id);


--
-- Name: idx_payments_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_org ON public.payment_transactions USING btree (org_id);


--
-- Name: idx_payments_razorpay_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_razorpay_order ON public.payment_transactions USING btree (razorpay_order_id);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_status ON public.payment_transactions USING btree (payment_status);


--
-- Name: idx_pricing_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_active ON public.subscription_pricing USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_usage_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_created ON public.service_usage_logs USING btree (created_at DESC);


--
-- Name: idx_usage_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_org ON public.service_usage_logs USING btree (org_id);


--
-- Name: idx_usage_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_reference ON public.service_usage_logs USING btree (reference_id);


--
-- Name: idx_usage_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_service ON public.service_usage_logs USING btree (service_type);


--
-- Name: idx_wallet_txn_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_txn_created ON public.wallet_transactions USING btree (created_at DESC);


--
-- Name: idx_wallet_txn_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_txn_org ON public.wallet_transactions USING btree (org_id);


--
-- Name: idx_wallet_txn_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_txn_reference ON public.wallet_transactions USING btree (reference_id, reference_type);


--
-- Name: idx_wallet_txn_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_txn_type ON public.wallet_transactions USING btree (transaction_type);


--
-- Name: organization_settings organization_settings_demo_host_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_demo_host_user_id_fkey FOREIGN KEY (demo_host_user_id) REFERENCES public.profiles(id);


--
-- Name: organization_settings organization_settings_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_settings organization_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: organization_subscriptions organization_subscriptions_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_subscriptions
    ADD CONSTRAINT organization_subscriptions_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_subscriptions organization_subscriptions_override_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_subscriptions
    ADD CONSTRAINT organization_subscriptions_override_by_fkey FOREIGN KEY (override_by) REFERENCES auth.users(id);


--
-- Name: payment_transactions payment_transactions_initiated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES auth.users(id);


--
-- Name: payment_transactions payment_transactions_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.subscription_invoices(id);


--
-- Name: payment_transactions payment_transactions_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: service_usage_logs service_usage_logs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_usage_logs
    ADD CONSTRAINT service_usage_logs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: service_usage_logs service_usage_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_usage_logs
    ADD CONSTRAINT service_usage_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: service_usage_logs service_usage_logs_wallet_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_usage_logs
    ADD CONSTRAINT service_usage_logs_wallet_transaction_id_fkey FOREIGN KEY (wallet_transaction_id) REFERENCES public.wallet_transactions(id);


--
-- Name: subscription_invoices subscription_invoices_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_invoices
    ADD CONSTRAINT subscription_invoices_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: subscription_invoices subscription_invoices_waived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_invoices
    ADD CONSTRAINT subscription_invoices_waived_by_fkey FOREIGN KEY (waived_by) REFERENCES auth.users(id);


--
-- Name: subscription_pricing subscription_pricing_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_pricing
    ADD CONSTRAINT subscription_pricing_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: wallet_transactions wallet_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: wallet_transactions wallet_transactions_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: wallet_transactions wallet_transactions_payment_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_payment_transaction_id_fkey FOREIGN KEY (payment_transaction_id) REFERENCES public.payment_transactions(id);


--
-- Name: service_usage_logs Admins can view org usage; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: subscription_pricing Everyone can view active pricing; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: organization_settings Org members insert settings; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: organization_settings Org members update settings; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: organization_settings Org members view settings; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: subscription_invoices Platform admins can manage all invoices; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: organization_subscriptions Platform admins can manage all subscriptions; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: subscription_pricing Platform admins can manage pricing; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: wallet_transactions Platform admins can manage wallet transactions; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: payment_transactions Platform admins can view all transactions; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: service_usage_logs Platform admins can view all usage; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: organization_settings Platform admins manage settings; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: wallet_transactions Service role can create wallet transactions; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: service_usage_logs Service role can insert usage; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: organization_subscriptions Service role can manage all subscriptions; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: subscription_invoices Service role can manage invoices; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: payment_transactions Service role can manage transactions; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: organization_settings Service role manages settings; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: payment_transactions Users can create transactions for their org; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: subscription_invoices Users can view their org invoices; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: organization_subscriptions Users can view their org subscription; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: payment_transactions Users can view their org transactions; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: wallet_transactions Users can view their org wallet transactions; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: service_usage_logs Users can view their own usage; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: organization_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: service_usage_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_usage_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_pricing; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_pricing ENABLE ROW LEVEL SECURITY;

--
-- Name: wallet_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

--
--

\unrestrict 24N2FKh1r3OIQRBZt8WsDfoFB6taGva4UhdRq70yaQDzk6w64N2ORAI4nZDfJLK
-- PART C — enforcement functions (adapted from globalcrm reference)
-- ats keeps its own user_roles-based is_platform_admin(); not redefined here.
-- get_user_org_id reads profiles.org_id (single-org model, matching globalcrm).
-- ============================================================================

-- Dual lock gate: subscription overdue (locked/cancelled) OR wallet floor breached.
-- Internal orgs are never locked.
CREATE OR REPLACE FUNCTION public.is_org_locked(_org_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_subscriptions s
    JOIN public.organizations o ON o.id = s.org_id
    WHERE s.org_id = _org_id
      AND coalesce(o.is_internal, false) = false
      AND (
        s.subscription_status IN ('suspended_locked', 'cancelled')
        OR coalesce(s.wallet_balance, 0) <= coalesce(s.wallet_minimum_balance, 0)
      )
  )
$function$;

-- Single-org accessor — returns NULL when the org is locked (the lock cascade),
-- unless the caller is a platform admin.
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT p.org_id
  FROM public.profiles p
  WHERE p.id = _user_id
    AND (
      public.is_platform_admin(_user_id)
      OR NOT public.is_org_locked(p.org_id)
    )
  LIMIT 1
$function$;

-- Lock-free accessor for billing/identity tables (a locked customer must still
-- reach and pay their bill).
CREATE OR REPLACE FUNCTION public.get_user_org_id_unlocked(_user_id uuid)
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT org_id FROM public.profiles WHERE id = _user_id LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.is_current_org_locked()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT public.is_org_locked(public.get_user_org_id_unlocked(auth.uid()))
$function$;

CREATE OR REPLACE FUNCTION public.get_active_pricing()
 RETURNS TABLE(one_time_setup_cost numeric, per_user_monthly_cost numeric, min_wallet_balance numeric, email_cost_per_unit numeric, whatsapp_cost_per_unit numeric, call_cost_per_minute numeric, call_cost_per_call numeric, auto_topup_amount numeric, gst_percentage numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    one_time_setup_cost, per_user_monthly_cost, min_wallet_balance,
    email_cost_per_unit, whatsapp_cost_per_unit, call_cost_per_minute, call_cost_per_call,
    auto_topup_amount, gst_percentage
  FROM public.subscription_pricing
  WHERE is_active = true
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_monthly_amount(_org_id uuid)
 RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  user_count INT;
  per_user_cost NUMERIC;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.profiles WHERE org_id = _org_id;
  SELECT per_user_monthly_cost INTO per_user_cost FROM public.subscription_pricing WHERE is_active = true LIMIT 1;
  RETURN user_count * coalesce(per_user_cost, 0);
END;
$function$;

-- Atomic, floor-checked wallet deduction (row lock + ledger + usage log).
CREATE OR REPLACE FUNCTION public.deduct_from_wallet(_org_id uuid, _amount numeric, _service_type text, _reference_id uuid, _quantity numeric, _unit_cost numeric, _user_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  current_balance NUMERIC;
  min_balance NUMERIC;
  new_balance NUMERIC;
  wallet_txn_id UUID;
BEGIN
  SELECT wallet_balance, wallet_minimum_balance INTO current_balance, min_balance
  FROM public.organization_subscriptions WHERE org_id = _org_id FOR UPDATE;

  IF current_balance - _amount < min_balance THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_wallet_balance',
      'current_balance', current_balance, 'min_balance', min_balance);
  END IF;

  new_balance := current_balance - _amount;
  UPDATE public.organization_subscriptions SET wallet_balance = new_balance, updated_at = NOW() WHERE org_id = _org_id;

  INSERT INTO public.wallet_transactions (org_id, transaction_type, amount, balance_before, balance_after, reference_id, reference_type, quantity, unit_cost)
  VALUES (_org_id,
    CASE WHEN _service_type = 'email' THEN 'deduction_email'
         WHEN _service_type = 'whatsapp' THEN 'deduction_whatsapp'
         WHEN _service_type = 'call' THEN 'deduction_call' END,
    -_amount, current_balance, new_balance, _reference_id, _service_type, _quantity, _unit_cost)
  RETURNING id INTO wallet_txn_id;

  INSERT INTO public.service_usage_logs (org_id, service_type, reference_id, user_id, quantity, cost, wallet_deducted, wallet_transaction_id)
  VALUES (_org_id, _service_type, _reference_id, _user_id, _quantity, _amount, true, wallet_txn_id);

  RETURN jsonb_build_object('success', true, 'new_balance', new_balance, 'wallet_transaction_id', wallet_txn_id);
END;
$function$;

-- 2-day grace then full lock; internal + override aware.
CREATE OR REPLACE FUNCTION public.check_and_update_subscription_status(_org_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  sub RECORD;
  latest_invoice RECORD;
  days_overdue INT;
  new_status TEXT;
  v_is_internal BOOLEAN;
BEGIN
  SELECT coalesce(o.is_internal, false) INTO v_is_internal FROM public.organizations o WHERE o.id = _org_id;
  IF v_is_internal THEN
    UPDATE public.organization_subscriptions
      SET subscription_status = 'active', suspension_date = NULL, suspension_reason = NULL, updated_at = NOW()
      WHERE org_id = _org_id AND subscription_status <> 'active';
    UPDATE public.organizations SET services_enabled = true WHERE id = _org_id AND services_enabled = false;
    RETURN;
  END IF;

  SELECT * INTO sub FROM public.organization_subscriptions WHERE org_id = _org_id;
  IF sub IS NULL THEN RETURN; END IF;

  IF sub.suspension_override_until IS NOT NULL AND sub.suspension_override_until >= CURRENT_DATE THEN
    RETURN;
  END IF;

  SELECT * INTO latest_invoice FROM public.subscription_invoices
  WHERE org_id = _org_id AND payment_status IN ('pending', 'overdue') AND due_date <= CURRENT_DATE
  ORDER BY due_date DESC LIMIT 1;

  IF latest_invoice IS NULL THEN
    IF sub.subscription_status <> 'active' THEN
      UPDATE public.organization_subscriptions
        SET subscription_status = 'active', suspension_date = NULL, suspension_reason = NULL, updated_at = NOW()
        WHERE org_id = _org_id;
      UPDATE public.organizations SET services_enabled = true WHERE id = _org_id;
    END IF;
    RETURN;
  END IF;

  days_overdue := CURRENT_DATE - latest_invoice.due_date;
  IF days_overdue <= 2 THEN new_status := 'suspended_grace'; ELSE new_status := 'suspended_locked'; END IF;

  IF sub.subscription_status <> new_status THEN
    UPDATE public.organization_subscriptions
      SET subscription_status = new_status,
          suspension_date = CASE WHEN new_status <> 'active' THEN NOW() ELSE NULL END,
          suspension_reason = 'Payment overdue for invoice ' || latest_invoice.invoice_number,
          grace_period_end = latest_invoice.due_date + INTERVAL '2 days',
          lockout_date = latest_invoice.due_date + INTERVAL '3 days',
          updated_at = NOW()
      WHERE org_id = _org_id;
    UPDATE public.organizations SET services_enabled = (new_status = 'suspended_grace') WHERE id = _org_id;
    UPDATE public.subscription_invoices SET payment_status = 'overdue' WHERE id = latest_invoice.id;
  END IF;
END;
$function$;

-- ============================================================================
-- PART D — make ats's existing membership checks lock-aware, so the billing
-- lock cascades through every existing tenant-table policy. Logic preserved
-- exactly; only "AND NOT is_org_locked(org)" added. Platform admins bypass.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT public.is_platform_admin(_user_id)
  OR (
    EXISTS (SELECT 1 FROM public.org_memberships WHERE user_id = _user_id AND org_id = _org_id)
    AND NOT public.is_org_locked(_org_id)
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _role org_role)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT public.is_platform_admin(_user_id)
  OR (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE user_id = _user_id AND org_id = _org_id
        AND (role = _role OR (_role = 'member' AND role = 'org_admin'))
    )
    AND NOT public.is_org_locked(_org_id)
  );
$function$;

-- ============================================================================

-- ============================================================================
-- PART B(2) — RLS policies on billing tables (reference get_user_org_id*)
-- ============================================================================
CREATE POLICY "Admins can view org usage" ON public.service_usage_logs FOR SELECT USING (((org_id = public.get_user_org_id(auth.uid())) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))));
CREATE POLICY "Everyone can view active pricing" ON public.subscription_pricing FOR SELECT USING (true);
CREATE POLICY "Org members insert settings" ON public.organization_settings FOR INSERT WITH CHECK ((org_id = public.get_user_org_id(auth.uid())));
CREATE POLICY "Org members update settings" ON public.organization_settings FOR UPDATE USING ((org_id = public.get_user_org_id(auth.uid()))) WITH CHECK ((org_id = public.get_user_org_id(auth.uid())));
CREATE POLICY "Org members view settings" ON public.organization_settings FOR SELECT USING ((org_id = public.get_user_org_id(auth.uid())));
CREATE POLICY "Platform admins can manage all invoices" ON public.subscription_invoices USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins can manage all subscriptions" ON public.organization_subscriptions USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins can manage pricing" ON public.subscription_pricing USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins can manage wallet transactions" ON public.wallet_transactions USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins can view all transactions" ON public.payment_transactions FOR SELECT USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins can view all usage" ON public.service_usage_logs FOR SELECT USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins manage settings" ON public.organization_settings USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "Service role can create wallet transactions" ON public.wallet_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can insert usage" ON public.service_usage_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can manage all subscriptions" ON public.organization_subscriptions USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage invoices" ON public.subscription_invoices USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage transactions" ON public.payment_transactions USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages settings" ON public.organization_settings USING (true) WITH CHECK (true);
CREATE POLICY "Users can create transactions for their org" ON public.payment_transactions FOR INSERT WITH CHECK (((org_id = public.get_user_org_id_unlocked(auth.uid())) AND (initiated_by = auth.uid())));
CREATE POLICY "Users can view their org invoices" ON public.subscription_invoices FOR SELECT USING ((org_id = public.get_user_org_id_unlocked(auth.uid())));
CREATE POLICY "Users can view their org subscription" ON public.organization_subscriptions FOR SELECT USING ((org_id = public.get_user_org_id_unlocked(auth.uid())));
CREATE POLICY "Users can view their org transactions" ON public.payment_transactions FOR SELECT USING ((org_id = public.get_user_org_id_unlocked(auth.uid())));
CREATE POLICY "Users can view their org wallet transactions" ON public.wallet_transactions FOR SELECT USING ((org_id = public.get_user_org_id(auth.uid())));
CREATE POLICY "Users can view their own usage" ON public.service_usage_logs FOR SELECT USING ((user_id = auth.uid()));

-- PART E — seed the single active pricing row (globalcrm defaults; edit later)
-- ============================================================================
INSERT INTO public.subscription_pricing (
  one_time_setup_cost, per_user_monthly_cost, min_wallet_balance,
  email_cost_per_unit, whatsapp_cost_per_unit, call_cost_per_minute, call_cost_per_call,
  auto_topup_amount, gst_percentage, is_active
)
SELECT 2000, 799, 500, 1, 0.20, 3, 0, 5000, 18, true
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_pricing WHERE is_active = true);

-- ============================================================================
-- PART F — existing org(s) are the team's own / demo: exempt from billing.
-- (ats is greenfield; this protects the bootstrap org from ever locking.)
-- ============================================================================
UPDATE public.organizations SET is_internal = true WHERE is_internal = false
  AND id NOT IN (SELECT org_id FROM public.organization_subscriptions);
