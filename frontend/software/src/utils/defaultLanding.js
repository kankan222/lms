export function getDefaultLandingPath(user) {
  const roles = user?.roles || [];
  const permissions = user?.permissions || [];

  if (roles.includes("super_admin")) return "/dashboard";
  if (roles.includes("teacher")) return "/teachers";
  if (roles.includes("parent")) return "/students";
  if (roles.includes("accounts")) return "/fees";
  if (roles.includes("staff")) return "/attendance";

  if (permissions.includes("dashboard.view")) return "/dashboard";
  if (permissions.includes("teacher.view")) return "/teachers";
  if (permissions.includes("student.view")) return "/students";
  if (permissions.includes("fee.view")) return "/fees";
  if (permissions.includes("attendance.take")) return "/attendance";

  return "/unauthorized";
}
