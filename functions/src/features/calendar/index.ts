export {
  calendarPostEvent,
} from "./http";

// Compatibility exports: these Cloud Function names are Google integration
// endpoints, but they are still re-exported here so deployed function names stay stable.
export {
  calendarConnectStart,
  driveConnectStart,
  googleOAuthCallback,
  calendarDisconnect,
  driveDisconnect,
  calendarStatus,
  driveStatus,
} from "../google";
