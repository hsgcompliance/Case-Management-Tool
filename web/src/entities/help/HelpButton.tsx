// entities/help/HelpButton.tsx
"use client";
import React from "react";
import { Modal } from "@entities/ui/Modal";
import { useAuth } from "@app/auth/AuthProvider";
import { isAdminLike } from "@lib/roles";
import { useOrgConfig, useSaveOrgConfig } from "@hooks/useOrgConfig";
import { toast } from "@lib/toast";
import dynamic from "next/dynamic";

// TipTap is heavy and only needed when an admin opens the help editor —
// keep it out of the shared bundle.
const RichTextEditor = dynamic(
  () => import("./RichTextEditor").then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <div className="p-4 text-xs text-slate-400">Loading editor…</div> }
);

export type HelpPageKey = "customers" | "customersModal" | "budget" | "programs" | "budgetPipeline" | "invoiceTool";

const PAGE_TITLES: Record<HelpPageKey, string> = {
  customers: "Customers - Help & Reference",
  customersModal: "Customer Details - Help & Reference",
  budget: "Budget - Help & Reference",
  programs: "Programs - Help & Reference",
  budgetPipeline: "Budget Pipelines - Help & Reference",
  invoiceTool: "Invoicing - Help & Reference",
};

const DEFAULT_CONTENT: Record<HelpPageKey, string> = {
  customers: [
    "<h2>Customers Overview</h2>",
    "<p>The Customers page lists all clients in the system. Each customer can be linked to one or more <strong>enrollments</strong> which connect them to a grant and program.</p>",
    "<h3>Key Fields</h3>",
    "<ul>",
    "<li><strong>Status</strong> — Active or Inactive</li>",
    "<li><strong>Population</strong> — Youth, Family, or Individual</li>",
    "<li><strong>Case Manager</strong> — The assigned staff member responsible for this client</li>",
    "</ul>",
    "<h3>Adding a Customer</h3>",
    "<ol>",
    "<li>Click <em>New Customer</em> and fill in the name, contact info, and demographics</li>",
    "<li>Open the customer record and go to the <strong>Enrollments</strong> tab</li>",
    "<li>Create an enrollment, selecting the relevant grant and program</li>",
    "<li>Assign a case manager and set the enrollment start date</li>",
    "</ol>",
    "<h3>Understanding Enrollments</h3>",
    "<p>An enrollment links a customer to a <strong>grant</strong> (the funding source) and a <strong>program</strong> (the service model). ",
    "Payments recorded against an enrollment draw from the grant's line items.</p>",
  ].join(""),

  customersModal: [
    "<h2>Customer Detail Tabs</h2>",
    "<ul>",
    "<li><strong>Details</strong> — Name, contact info, demographics, and status</li>",
    "<li><strong>Enrollments</strong> — Grant/program enrollments, spending history, and payment projections</li>",
    "<li><strong>Case Management</strong> — CM notes, task schedule, and assigned case manager</li>",
    "<li><strong>Assessments</strong> — Intake and ongoing assessments linked to the enrollment workflow</li>",
    "<li><strong>Tasks</strong> — Open and completed tasks across all enrollments</li>",
    "<li><strong>Payments</strong> — Full payment ledger and projection queue</li>",
    "<li><strong>Files</strong> — Google Drive documents attached to this customer</li>",
    "</ul>",
    "<h3>Enrollment Workflow</h3>",
    "<ol>",
    "<li>Create enrollment on the Enrollments tab — select grant + program</li>",
    "<li>System auto-builds a task schedule based on the program template</li>",
    "<li>Complete tasks and assessments as services are delivered</li>",
    "<li>Record payments; the ledger updates grant spending in real time</li>",
    "</ol>",
    "<h3>Schema Notes</h3>",
    "<p>Each enrollment has a <code>status</code> (active / closed / deleted) and a <code>taskSchedule</code> array. ",
    "Payments are written to the <code>ledger</code> collection and queued in <code>paymentQueue</code> for projection.</p>",
  ].join(""),

  budget: [
    "<h2>Budget Overview</h2>",
    "<p>The Budget page shows records with financial activity, including spend-down grants, billable programs, credit-card budget activity, and line-item reporting. Each record's financial model controls whether line-item amounts are hard budget caps or billing/reference categories.</p>",
    "<h3>Key Concepts</h3>",
    "<ul>",
    "<li><strong>Grant</strong> — A funding source with a total budget, divided into <em>line items</em> (e.g. Rental Assistance, Utilities, Case Management)</li>",
    "<li><strong>Program</strong> — A service model linked to one or more grants; defines the enrollment workflow and task schedule template</li>",
    "<li><strong>Enrollment</strong> — A customer's participation in a grant or program; payment objects inherit the enrollment's financial context.</li>",
    "<li><strong>Projected Spend</strong> — Spent + unpaid future obligations from the payment projection queue</li>",
    "<li><strong>Balance / Activity</strong> — Budgeted records show remaining availability; billable records show recorded and projected activity.</li>",
    "</ul>",
    "<h3>Grants vs Programs</h3>",
    "<p>Programs and grants can both be enrollment targets. A record's financial model decides how it behaves in budget, billing, and activity views.</p>",
    "<p>For example, <strong>Rental Assistance Client</strong> may be a service Program, <strong>TSS Supportive Services</strong> may be a billable Program, and <strong>YHDP RRH 25-26</strong> may be a budgeted Grant. Customers can be enrolled in one or more of these depending on the workflow.</p>",
    "<ul>",
    "<li>Use service-only Programs for long-term participation, service history, and year-over-year counts.</li>",
    "<li>Use billable Programs when the record needs billing categories, ledger activity, and enrollment controls without a spend-down award balance.</li>",
    "<li>Use budgeted Grants for award tracking, hard line-item budgets, spending, reimbursement, and funder reporting.</li>",
    "</ul>",
    "<h3>Adding a Grant</h3>",
    "<ol>",
    "<li>Click <em>+ New Grant</em> and fill in the name, funder, and total amount</li>",
    "<li>Add line items inside the grant to allocate budget by category</li>",
    "<li>On the Programs page, link the grant to a program</li>",
    "<li>Enroll customers in that program and record payments to draw from line items</li>",
    "</ol>",
    "<h3>Custom Layout</h3>",
    "<p>Admins can use <em>Configure</em> to create groups and control which grants appear as cards, ",
    "in what order, and with which color theme. Use the <em>Custom</em> vs <em>All Grants</em> toggle to switch views.</p>",
  ].join(""),

  programs: [
    "<h2>Programs Overview</h2>",
    "<p>Programs are ongoing service areas that customers can enroll in over time. They are useful for tracking participation, service history, case management context, and customer counts across changing funding sources.</p>",
    "<h3>What Belongs Here</h3>",
    "<ul>",
    "<li><strong>Rental Assistance Client</strong> - a Program for customers receiving rental-assistance services over time.</li>",
    "<li><strong>Blueprint Client</strong> - a youth Program for customers participating in Blueprint services.</li>",
    "<li><strong>Other service areas</strong> - any ongoing participation category that should roll forward year to year.</li>",
    "</ul>",
    "<h3>Programs vs Grants</h3>",
    "<p>Programs and grants intentionally share the enrollment system, but they represent different things.</p>",
    "<ul>",
    "<li><strong>Programs</strong> track ongoing service participation and should not require grant budgets, award amounts, reimbursement workflows, or cycle closeout fields.</li>",
    "<li><strong>Grants</strong> track funding sources or funding cycles. They may have budgets, start/end dates, eligibility rules, reporting requirements, and spend tracking.</li>",
    "<li>A customer may be enrolled in a Program, a Grant, or both. That is expected when the organization wants both long-term service tracking and funding-cycle tracking.</li>",
    "</ul>",
    "<h3>How to Use Program Counts</h3>",
    "<ul>",
    "<li>Use active enrollments to understand who is currently participating in a service area.</li>",
    "<li>Use inactive or historical enrollments to understand prior participation without resetting the Program each year.</li>",
    "<li>Use unique customer counts when reporting Program participation, especially when the same customer also has one or more Grant enrollments.</li>",
    "</ul>",
    "<h3>Relationship to Grants</h3>",
    "<p>A Program can be funded by multiple Grants over time. A Grant can also support services associated with more than one Program. Those relationships may be useful for navigation and reporting, but the authoritative enrollment link remains the enrollment's grant/program target and name.</p>",
    "<p>Example: <strong>YHDP RRH 25-26</strong> may pay for services delivered under the broader <strong>Rental Assistance Client</strong> Program. The Grant belongs in budget views; the Program belongs in participation and service views.</p>",
    "<h3>When to Create a Program</h3>",
    "<ul>",
    "<li>Create a Program when the category should roll forward year to year.</li>",
    "<li>Create a Program when staff need participation counts independent of a specific funder or award cycle.</li>",
    "<li>Create a Grant instead when the record primarily represents funding, budget, spend, reimbursement, or funder reporting.</li>",
    "</ul>",
  ].join(""),

  budgetPipeline: [
    "<h2>Budget Pipeline Overview</h2>",
    "<p>Budget pipelines automatically classify pending payment queue objects to a grant and line item. Each pipeline represents one budget target, and can hold separate <strong>Credit Card</strong> and <strong>Invoice</strong> schemas under that same target.</p>",
    "<blockquote>Use one pipeline when the card and invoice rules both point to the same grant/line item. Use separate pipelines when the budget target is different.</blockquote>",
    "<h2>How to Make a Pipeline</h2>",
    "<ol>",
    "<li><strong>Choose the target.</strong> Select the Grant and, when needed, a specific Line Item. This is what matching payment objects will be assigned to.</li>",
    "<li><strong>Name the pipeline clearly.</strong> Good names usually describe the budget target, for example <em>PATH Outreach Supplies</em> or <em>TSS Client Transportation</em>.</li>",
    "<li><strong>Pick a schema tab.</strong> Use the Credit Card tab for card purchase objects and the Invoice tab for invoice split objects.</li>",
    "<li><strong>Enable the schema.</strong> A disabled schema is saved but will not run. This lets you draft card and invoice logic independently.</li>",
    "<li><strong>Add Include rules.</strong> Include rules decide what belongs in this budget. Empty include rules match all pending objects from that form, so add at least one meaningful rule before activating broad pipelines.</li>",
    "<li><strong>Add Exclude rules when needed.</strong> Exclude rules remove exceptions after include rules pass. Negative operators such as <em>is not</em> or <em>does not contain</em> pass when the field is empty; use <em>is not empty</em> when you require an answered field.</li>",
    "<li><strong>Preview before activating.</strong> Preview shows pending queue objects that would match and warns when another active pipeline already matches the same object.</li>",
    "<li><strong>Save or Activate.</strong> Draft pipelines do nothing. Active pipelines run against newly-created pending payment queue objects.</li>",
    "</ol>",
    "<h3>Choosing Fields</h3>",
    "<ul>",
    "<li><strong>Standard fields</strong> are normalized values on the payment object, such as Amount, Card, Payment Method, Customer, Month, and Source.</li>",
    "<li><strong>Transaction fields</strong> come from the live Jotform transaction window. They use the current visible labels and live dropdown options from Jotform.</li>",
    "<li>When a dropdown option changes in Jotform, the field selector should reflect the updated options after the form metadata reloads.</li>",
    "<li>For repeated transactions, the system expects sibling transaction windows to share one schema. If one window drifts from the others, extraction fails loudly instead of guessing.</li>",
    "</ul>",
    "<h2>Advanced Flow: Jotform to Ledger</h2>",
    "<h3>1. Jotform Metadata Defines the Extraction Shape</h3>",
    "<p>The system reads live Jotform question metadata for the two spending forms: Credit Card Purchase Documentation and Invoice Requests. It uses ordered question metadata, transaction headers, and repeated field-label patterns to infer transaction windows.</p>",
    "<ul>",
    "<li><strong>Credit Cards:</strong> the purchase side becomes one repeated transaction schema. The return path is handled separately.</li>",
    "<li><strong>Invoices:</strong> customer-side and program-side breakdown fields are treated as conditional halves of one logical transaction model.</li>",
    "<li>Only normalized transaction labels are shown in the builder, but those labels map back to the live Jotform field IDs for extraction.</li>",
    "</ul>",
    "<h3>2. A Submission Becomes Payment Queue Objects</h3>",
    "<p>When a spending form submission syncs, the extractor reads the raw answers and the inferred transaction model. The original submission can produce multiple payment queue rows because the queue operates on split payment objects, not the whole form.</p>",
    "<ul>",
    "<li>A five-transaction credit card checkout can become five queue objects.</li>",
    "<li>An invoice billed across multiple grants can become multiple queue objects, one per billed breakdown.</li>",
    "<li>Each queue object keeps raw answers, normalized top-level fields, and a <code>transactionFields</code> map keyed by normalized transaction labels such as <code>tx:bill-to</code> or <code>tx:supportive-services-program</code>.</li>",
    "</ul>",
    "<h3>3. The Queue Object Enters Pending Review</h3>",
    "<p>New extracted objects enter the <code>paymentQueue</code> collection with <code>queueStatus = pending</code>. At this point they may be unassigned, manually assigned, or automatically assigned by an active budget pipeline.</p>",
    "<h3>4. Active Pipelines Try to Assign the Object</h3>",
    "<p>When a pending queue object is created, active pipelines for the same organization run in creation order. The first matching pipeline wins.</p>",
    "<ol>",
    "<li>The pipeline checks whether it has an enabled schema for the object's <code>formId</code>.</li>",
    "<li>The correct schema's include rules are evaluated against standard fields and <code>tx:</code> transaction fields.</li>",
    "<li>If include rules match, exclude rules are evaluated.</li>",
    "<li>If the object is included and not excluded, the pipeline stamps its Grant and Line Item onto the queue object.</li>",
    "<li>Later matching pipelines are skipped because first match wins.</li>",
    "</ol>",
    "<h3>5. Review and Posting to Ledger</h3>",
    "<p>The payment queue remains the review surface. Staff can inspect the extracted object, correct assignment if needed, and then post/mark paid through the invoicing/payment workflow. Posting writes the finalized spend into the ledger so budget totals reflect the actual expense.</p>",
    "<ul>",
    "<li><strong>Queue object:</strong> operational review item created from a Jotform submission or split transaction.</li>",
    "<li><strong>Grant/line assignment:</strong> target budget chosen manually or by pipeline.</li>",
    "<li><strong>Ledger entry:</strong> final accounting record that moves spend into budget totals.</li>",
    "</ul>",
    "<h3>Operational Rules to Remember</h3>",
    "<ul>",
    "<li>Keep pipeline rules specific enough that only one active pipeline should match a payment object.</li>",
    "<li>Use Preview after changing form dropdowns or adding transaction fields.</li>",
    "<li>If a pipeline should cover both card and invoice submissions for the same budget, enable both schemas inside the same pipeline.</li>",
    "<li>If a card rule and invoice rule route to different grant/line targets, they should be separate pipelines.</li>",
    "<li>Do not rely on raw Jotform field IDs unless absolutely necessary; normalized standard and transaction fields are safer because they survive form edits better.</li>",
    "</ul>",
  ].join(""),

  invoiceTool: [
    "<h2>Invoicing Tool Overview</h2>",
    "<p>The Invoicing tool is the review surface for payment objects. It brings together enrollment projections, credit card queue objects, invoice queue objects, and posted ledger rows so staff can filter, classify, complete data entry, and post finalized spending.</p>",
    "<p>For automatic classification rules, open the <a href=\"/tools/budget-map\">Budget Pipeline tool</a>. Pipelines assign incoming credit-card and invoice payment objects to grant and line-item targets before staff review.</p>",

    "<h2>How to Filter</h2>",
    "<ol>",
    "<li><strong>Choose a view.</strong> Use the view chips at the top for common workflows like All Spending, CC + Invoices, Open Invoices, or pinned grant-specific views.</li>",
    "<li><strong>Choose a source type.</strong> Use All, CC + Invoices, Enrollment, Card, or Invoice to focus the table.</li>",
    "<li><strong>Filter by grant, month, workflow, or search.</strong> Grant narrows to a budget target; month narrows reporting period; workflow separates open review items from closed/posted rows.</li>",
    "<li><strong>Use column filters for loaded rows.</strong> Advanced filters can search visible queue fields, including raw answers and extracted transaction fields when they are loaded in the table.</li>",
    "<li><strong>Save useful filters.</strong> Save Filter View keeps a reusable local view. Admin-created presets can be shared across the organization.</li>",
    "</ol>",

    "<h2>Payment Objects: Enrollment vs Invoice/Credit Card</h2>",
    "<h3>Enrollment Payment Objects</h3>",
    "<p>Enrollment payment objects come from customer enrollment payment schedules. They usually represent planned or recurring service spend tied to a customer, enrollment, grant, program, and line item. These objects are projection-first: they help show expected spend before the actual payment is completed.</p>",
    "<ul>",
    "<li>They are linked to an enrollment object, which connects a customer to a program and grant.</li>",
    "<li>They can move through compliance/data-entry steps before becoming final spend.</li>",
    "<li>When posted, they write ledger records that update the grant budget.</li>",
    "</ul>",

    "<h3>Invoice and Credit Card Payment Objects</h3>",
    "<p>Invoice and credit-card payment objects come from Jotform spending submissions. They are transaction-first: a single Jotform submission may split into several payment queue objects because each transaction or invoice breakdown can hit a different grant or line item.</p>",
    "<ul>",
    "<li><strong>Credit card objects</strong> come from repeated purchase transaction windows, with returns handled on a separate path.</li>",
    "<li><strong>Invoice objects</strong> come from invoice breakdown rows. A single invoice can become multiple grant-billed payment objects.</li>",
    "<li>Each object stores raw answers, normalized standard fields, and normalized transaction fields such as <code>tx:bill-to</code>, <code>tx:path-services</code>, or <code>tx:supportive-services-program</code>.</li>",
    "</ul>",

    "<h2>SOP: Payment Object Flow</h2>",
    "<h3>1. Intake</h3>",
    "<p>Spending enters the system from either an enrollment workflow or a Jotform form.</p>",
    "<ul>",
    "<li><strong>Enrollment intake:</strong> a payment schedule/payment row is created from an enrollment object tied to a customer and program.</li>",
    "<li><strong>Jotform intake:</strong> a credit-card or invoice submission is synced from Jotform with raw answers and form metadata.</li>",
    "</ul>",

    "<h3>2. Normalization and Splitting</h3>",
    "<p>The system converts source-specific data into payment objects that look consistent enough for filtering, review, and posting.</p>",
    "<ul>",
    "<li>Enrollment payment objects inherit customer, enrollment, grant/program context from the enrollment.</li>",
    "<li>Credit-card submissions split repeated transaction windows into individual queue objects.</li>",
    "<li>Invoice submissions split customer/program billing breakdowns into individual queue objects.</li>",
    "</ul>",

    "<h3>3. Classification</h3>",
    "<p>Payment objects need a grant and usually a line item before they can become useful budget spend. Classification can happen manually in the Invoicing tool or automatically through Budget Pipelines.</p>",
    "<ol>",
    "<li>For card/invoice queue objects, active budget pipelines evaluate the payment object's form-specific schema.</li>",
    "<li>If a pipeline matches, it stamps the target grant and line item onto the queue object.</li>",
    "<li>If no pipeline matches, the object stays available for manual assignment or No Grant Classification.</li>",
    "</ol>",

    "<h3>4. Review and Data Entry</h3>",
    "<p>Staff review open rows in the Invoicing tool. Typical checks include amount, vendor, customer/enrollment link, grant, line item, documentation, HMIS/CaseWorthy status, and invoice-submitted/data-entry status.</p>",

    "<h3>5. Posting</h3>",
    "<p>Posting closes the operational object and writes the finalized spend to the ledger. Ledger records are what budget totals ultimately read as actual spend. Queue objects preserve the intake and review history; ledger entries preserve the accounting effect.</p>",

    "<h2>Practical Rules</h2>",
    "<ul>",
    "<li>Use <strong>Enrollment</strong> filters when you are reviewing customer-service payment schedules or projections.</li>",
    "<li>Use <strong>Card</strong> or <strong>Invoice</strong> filters when you are reviewing Jotform spending submissions.</li>",
    "<li>Use <strong>CC + Invoices</strong> for data-entry completion across all spending-form queue rows.</li>",
    "<li>If repeated assignment mistakes appear, fix the relevant rule in <a href=\"/tools/budget-map\">Budget Pipelines</a> rather than manually correcting every future row.</li>",
    "<li>Before posting, confirm the grant/line item assignment and documentation are correct because posting updates the ledger and budget totals.</li>",
    "</ul>",
  ].join(""),
};

function HelpContent({ html }: { html: string }) {
  return (
    <div
      className={[
        "text-sm text-slate-700 dark:text-slate-300 leading-relaxed",
        "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-1 [&_h1]:text-slate-900 dark:[&_h1]:text-slate-100",
        "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-1 [&_h2]:text-slate-800 dark:[&_h2]:text-slate-200",
        "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-0.5 [&_h3]:text-slate-800 dark:[&_h3]:text-slate-200",
        "[&_p]:my-1.5",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5",
        "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5",
        "[&_li]:my-0.5",
        "[&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 dark:[&_blockquote]:border-slate-600 [&_blockquote]:pl-3 [&_blockquote]:text-slate-500 [&_blockquote]:italic [&_blockquote]:my-2",
        "[&_a]:text-sky-700 dark:[&_a]:text-sky-300 [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-2",
        "[&_strong]:font-semibold [&_em]:italic",
        "[&_code]:bg-slate-100 dark:[&_code]:bg-slate-800 [&_code]:px-1 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs",
        "[&_h2:first-child]:mt-0",
      ].join(" ")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function HelpButton({ pageKey }: { pageKey: HelpPageKey }) {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  const { profile } = useAuth();
  const isAdmin = isAdminLike(profile as { topRole?: unknown; role?: unknown } | null);

  const { data: config } = useOrgConfig();
  const saveConfig = useSaveOrgConfig();

  const storedHtml = config?.helpContent?.[pageKey] ?? "";
  const displayHtml = storedHtml || DEFAULT_CONTENT[pageKey];

  const close = () => { setOpen(false); setEditing(false); };

  const startEdit = () => {
    setDraft(storedHtml || DEFAULT_CONTENT[pageKey]);
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const save = async () => {
    if (!config) { toast("Org config not loaded.", { type: "error" }); return; }
    try {
      await saveConfig.mutateAsync({
        ...config,
        helpContent: { ...config.helpContent, [pageKey]: draft },
      });
      toast("Help content saved.", { type: "success" });
      setEditing(false);
    } catch (e: unknown) {
      toast((e as Error)?.message || "Save failed.", { type: "error" });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setEditing(false); setOpen(true); }}
        title="Help & reference"
        aria-label="Help"
        className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-500 dark:hover:text-blue-400 text-[11px] font-bold transition-colors leading-none select-none flex-shrink-0"
      >
        ?
      </button>

      <Modal
        isOpen={open}
        onClose={close}
        widthClass="max-w-3xl"
        title={
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base font-semibold truncate">{PAGE_TITLES[pageKey]}</span>
            {isAdmin && !editing && (
              <button
                type="button"
                onClick={startEdit}
                className="flex-shrink-0 text-xs px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Edit
              </button>
            )}
          </div>
        }
        footer={
          editing ? (
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={cancelEdit}
                disabled={saveConfig.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={save}
                disabled={saveConfig.isPending}
              >
                {saveConfig.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" onClick={close}>
              Close
            </button>
          )
        }
      >
        {editing ? (
          <RichTextEditor value={draft} onChange={setDraft} />
        ) : (
          <HelpContent html={displayHtml} />
        )}
      </Modal>
    </>
  );
}

export default HelpButton;
