/**
 * Declarative scaffold for Forms -> userTasks transitions.
 *
 * Only the first two rules are active. The disabled rules document the next
 * queue transitions without creating tasks until their completion signals are
 * defined and enabled deliberately.
 */
export const FORM_WORKFLOW_TASK_RULES = {
  intakeIncomplete: {
    enabled: true,
    event: "intake_progress_saved",
    assignment: "flow_owner",
    title: "Finish intake workflow",
  },
  eligibilityReview: {
    enabled: true,
    event: "jotform_submission_linked",
    formId: "251001226310030",
    assignment: "compliance_queue",
    title: "Intake complete — assess eligibility and continue follow-up",
  },
  referralToIntake: {
    enabled: false,
    event: "referral_submitted",
    assignment: "referral_owner",
    title: "Complete intake from referral",
  },
  basicIntakeToCompliance: {
    enabled: false,
    event: "basic_intake_completed",
    assignment: "compliance_queue",
    title: "Complete full intake review",
  },
  landlordContact: {
    enabled: false,
    event: "eligibility_confirmed",
    assignment: "compliance_queue",
    title: "Contact landlord and coordinate next steps",
  },
  mouFollowUp: {
    enabled: false,
    event: "landlord_contacted",
    assignment: "compliance_queue",
    title: "Follow up and complete the landlord MOU",
  },
  mouToPaymentCompliance: {
    enabled: false,
    event: "mou_completed",
    assignment: "compliance_queue",
    title: "MOU complete — enter payment information for budget alignment",
  },
} as const;

export const FORMS_APP_INTAKE_URL = "https://housing-db-forms.web.app/staff/intake";

export function intakeActionUrl(customerId: string): string {
  const params = new URLSearchParams({ customerId, start: "1" });
  return `${FORMS_APP_INTAKE_URL}?${params.toString()}`;
}
