import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  industry: string | null;
  plan: string;
  onboarding_completed: boolean;
}

interface OrgMembership {
  org_id: string;
  role: 'org_admin' | 'member';
  organization: Organization;
}

interface OrgContextType {
  currentOrg: Organization | null;
  orgs: OrgMembership[];
  orgRole: 'org_admin' | 'member' | null;
  isPlatformAdmin: boolean;
  loading: boolean;
  switchOrg: (orgId: string) => void;
  refreshOrgs: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType>({
  currentOrg: null,
  orgs: [],
  orgRole: null,
  isPlatformAdmin: false,
  loading: true,
  switchOrg: () => {},
  refreshOrgs: async () => {},
});

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [orgs, setOrgs] = useState<OrgMembership[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [orgRole, setOrgRole] = useState<'org_admin' | 'member' | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshOrgs = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    const uid = session.user.id;

    // Check platform admin
    const { data: paData } = await supabase.rpc('has_role', { _user_id: uid, _role: 'platform_admin' });
    setIsPlatformAdmin(!!paData);

    if (paData) {
      setOrgs([]);
      setCurrentOrg(null);
      setOrgRole(null);
      setLoading(false);
      return;
    }

    // Fetch memberships joined with organizations
    const { data: memberships } = await supabase
      .from('org_memberships')
      .select('org_id, role, organizations(id, name, slug, logo_url, industry, plan, onboarding_completed)')
      .eq('user_id', uid);

    const mapped: OrgMembership[] = (memberships || []).map((m: any) => ({
      org_id: m.org_id,
      role: m.role,
      organization: m.organizations,
    }));

    setOrgs(mapped);

    // Restore saved org or pick first
    const savedOrgId = localStorage.getItem('ats_current_org_id');
    const match = mapped.find(m => m.org_id === savedOrgId) || mapped[0];
    if (match) {
      setCurrentOrg(match.organization);
      setOrgRole(match.role);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    refreshOrgs();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setOrgs([]);
        setCurrentOrg(null);
        setOrgRole(null);
        setIsPlatformAdmin(false);
      } else if (event === 'SIGNED_IN') {
        refreshOrgs();
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshOrgs]);

  const switchOrg = useCallback((orgId: string) => {
    const match = orgs.find(m => m.org_id === orgId);
    if (match) {
      setCurrentOrg(match.organization);
      setOrgRole(match.role);
      localStorage.setItem('ats_current_org_id', orgId);
    }
  }, [orgs]);

  return (
    <OrgContext.Provider value={{ currentOrg, orgs, orgRole, isPlatformAdmin, loading, switchOrg, refreshOrgs }}>
      {children}
    </OrgContext.Provider>
  );
}

export const useOrg = () => useContext(OrgContext);
