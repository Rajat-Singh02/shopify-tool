import type { DashboardOverview } from "./admin-shell";

export function getDashboardOverview(): DashboardOverview {
  return {
    activeScopeLabel: "Manual upload only",
  };
}
