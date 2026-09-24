// Defines one row of the AlertLog table
// Shows status of an alert dispatch run, timestamp with optional details
import type { DispatchDetails } from "./dispatchStrategy";

export const LogStatus = {
  Success: "success",
  Warning: "warning",
  Error: "error",
} as const;
export type LogStatus = (typeof LogStatus)[keyof typeof LogStatus];

export type AlertLog = {
  id: number;
  alertId: number;
  status: LogStatus;
  error?: string;
  details?: DispatchDetails;
  createdAt: string;
};
