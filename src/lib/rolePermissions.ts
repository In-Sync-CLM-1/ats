export interface Permissions {
  canViewUsers: boolean;
  canEditUsers: boolean;
  canDeleteUsers: boolean;
  canViewSystemSettings: boolean;
  canViewWebhooks: boolean;
  canViewReports: boolean;
  canViewTeams: boolean;
  canViewDesignations: boolean;
  canViewPipelineStages: boolean;
  canManageTeams: boolean;
  canManageClients: boolean;
  canManageParticipants: boolean;
  canManageCampaigns: boolean;
  canDeleteClients: boolean;
  canManageProjects: boolean;
  canDeleteProjects: boolean;
  canViewSites: boolean;
  canManageSites: boolean;
  canViewHeadcountAgreements: boolean;
  canManageHeadcountAgreements: boolean;
  canViewZonalDashboard: boolean;
  canManageHeadcount: boolean;
  isZonalCoordinator: boolean;
}

export const getRolePermissions = (roles: string[], userId?: string): Permissions => {
  const hasRole = (role: string) => roles.includes(role);
  const isAdmin = hasRole('platform_admin') || hasRole('super_admin') || hasRole('admin_administration') || hasRole('admin_tech') || hasRole('admin');
  const isManagerOrAdmin = hasRole('manager') || isAdmin;
  const isZonalCoordinator = hasRole('zonal_coordinator');
  
  return {
    canViewUsers: isAdmin,
    canEditUsers: isAdmin,
    canDeleteUsers: isAdmin,
    canViewSystemSettings: hasRole('platform_admin') || hasRole('super_admin') || hasRole('admin_tech'),
    canViewWebhooks: hasRole('platform_admin') || hasRole('super_admin') || hasRole('admin_tech'),
    canViewReports: hasRole('platform_admin') || hasRole('super_admin') || roles.some(r => r.includes('admin')),
    canViewTeams: isAdmin,
    canViewDesignations: isAdmin,
    canViewPipelineStages: isAdmin,
    canManageTeams: isAdmin,
    canManageClients: true,
    canManageParticipants: true,
    canManageCampaigns: true,
    canDeleteClients: isManagerOrAdmin,
    canManageProjects: true,
    canDeleteProjects: isAdmin,
    canViewSites: isAdmin,
    canManageSites: isAdmin,
    canViewHeadcountAgreements: isAdmin,
    canManageHeadcountAgreements: isAdmin,
    canViewZonalDashboard: isZonalCoordinator || isAdmin,
    canManageHeadcount: isZonalCoordinator || isAdmin,
    isZonalCoordinator: isZonalCoordinator,
  };
};

export const getRoleHierarchy = () => [
  'platform_admin',
  'super_admin',
  'admin_administration',
  'admin_tech',
  'admin',
  'manager',
  'zonal_coordinator',
  'agent',
  'user',
  'client'
];

export const getRoleDisplayName = (role: string): string => {
  const roleMap: Record<string, string> = {
    platform_admin: 'Platform Admin',
    super_admin: 'Super Admin',
    admin_administration: 'Administration Admin',
    admin_tech: 'Tech Admin',
    admin: 'Admin',
    manager: 'Manager',
    zonal_coordinator: 'Zonal Coordinator',
    agent: 'Agent',
    user: 'User',
    client: 'Client',
  };
  return roleMap[role] || role;
};

export const getRoleVariant = (role: string): "default" | "destructive" | "secondary" | "outline" => {
  if (role === 'platform_admin') return 'default';
  if (role === 'super_admin') return 'destructive';
  if (role.includes('admin')) return 'secondary';
  return 'outline';
};