import { useState, useEffect } from "react";
import { getRolePermissions, Permissions } from "@/lib/rolePermissions";
import { supabase } from "@/integrations/supabase/client";

export const useUserPermissions = (): {
  permissions: Permissions;
  userRoles: string[];
  isLoading: boolean;
} => {
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRolesAndUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user?.id) {
        setUserId(session.user.id);
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id);
        
        setUserRoles(rolesData?.map(r => r.role) || []);
      }
      setIsLoading(false);
    };
    fetchRolesAndUser();
  }, []);

  const permissions = getRolePermissions(userRoles, userId);

  return { permissions, userRoles, isLoading };
};
