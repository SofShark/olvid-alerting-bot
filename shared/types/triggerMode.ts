// How often an alert is allowed to fire when its trigger condition
// stays satisfied. Shared by Polling and Monitoring sources — both
// evaluate on a cron cadence, both need edge-detection semantics.
// Webhook alerts are push-only and ignore this value.
//
//   EveryTime    fire on every evaluation while the condition is true.
//   OneShot      fire only when the condition transitions false → true.
//                Stays quiet on subsequent evaluations while still true.
//   WithRecovery same as OneShot plus a "recovery" message when the
//                condition transitions back true → false. The notifier
//                prefixes the message with "✓ RECOVERED:" so existing
//                bundle scripts don't need to know about this mode.
//
// Trigger mode is IGNORED when the condition is kind=None (every-poll
// alert by design) or operator=Changed (each change is itself an event).

export const TriggerMode = {
  EveryTime: "every-time",
  OneShot: "one-shot",
  WithRecovery: "with-recovery",
} as const;
export type TriggerMode = (typeof TriggerMode)[keyof typeof TriggerMode];
