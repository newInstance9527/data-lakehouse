/**
 * Module guides (EN) — four sections aligned with pageGuides.js
 * Module overview · How to operate · Usage example · What to do next
 */
function guide(title, sections) {
  return { title: `${title} · Guide`, sections }
}

function sections4({ about, ops, example, next }) {
  return [
    { heading: 'Module overview', type: 'text', content: about },
    { heading: 'How to operate', type: 'steps', items: ops },
    typeof example === 'string'
      ? { heading: 'Usage example', type: 'example', content: example }
      : { heading: 'Usage example', type: 'steps', items: example },
    { heading: 'What to do next', type: 'list', items: next },
  ]
}

export const PAGE_GUIDES_EN = {
  overview: guide(
    'Overview',
    sections4({
      about: [
        'The overview dashboard summarizes platform health along Ingest → Lake → Govern → Serve.',
        'It aggregates connectivity, assets, jobs, quality trends, and pending applications, with one-click navigation to the owning modules.',
      ],
      ops: [
        'Select a time range in the upper right; trend charts refresh accordingly.',
        'Click a pipeline stage or KPI card to open the related module.',
        'Open Details on a chart card to drill down.',
        'Click Refresh to re-aggregate module statistics.',
      ],
      example: [
        'Before a standup, set the range to the last 7 days and check the quality score trend.',
        'If pending applications rise, open Apply Center from that KPI.',
        'If quality dips, open Data Quality from Details and review failed rules.',
      ],
      next: [
        'Open Datasources to address connectivity issues.',
        'Open Job Ops to handle failed or delayed jobs.',
        'Open Apply Center for pending approvals.',
        'Open Data Quality to follow up on recent failures.',
      ],
    }),
  ),

  datasource: guide(
    'Datasources',
    sections4({
      about: [
        'Register and maintain connectable systems: databases, messaging, object/file stores, and HTTP APIs.',
        'Configure purpose (ingest, metadata-only, export target), owners, and connectivity; open table inventory before lake onboarding.',
      ],
      ops: [
        'Click Register datasource, choose type and purpose, enter connection details, then save.',
        'Filter by category or status, or search by name, address, or owner.',
        'Open the detail drawer to review metadata and run a connectivity test.',
        'Open Table inventory to sync or maintain source tables.',
        'Use Batch sync when multiple sources need structure refresh.',
      ],
      example:
        'Scenario: onboard a trading database\n1. Type MySQL, purpose Ingest\n2. Enter host, port, database, and credentials; test connectivity\n3. Sync table inventory\n4. Reference the source in an ETL ingest job',
      next: [
        'Confirm tables, keys, and partitions in Table inventory.',
        'Create an ingest job in ETL Orchestration.',
        'Register lake assets in the Asset Catalog.',
        'Project the source in Data Services if APIs are required.',
      ],
    }),
  ),

  'source-tables': guide(
    'Source tables',
    sections4({
      about: [
        'Lists source objects (tables, topics, paths) under a registered datasource with metadata summaries.',
        'Use it to confirm scope before ingest. This page describes source objects; lake assets are governed in the Asset Catalog.',
      ],
      ops: [
        'Open Table inventory from a datasource.',
        'Click Sync inventory to pull the latest structure.',
        'Search by name and browse pages.',
        'Manually add critical tables when the source is temporarily unreachable.',
        'Select tables from this list when registering assets.',
      ],
      example:
        'Scenario: register an order master table\nName: s_order\nPrimary key: order_id\nAction: sync or add manually → register as a detailed-layer asset in Catalog',
      next: [
        'Register the corresponding lake asset in Catalog.',
        'Use the table as an ETL source.',
        'Map source fields to standards.',
        'Return to Datasources to maintain connectivity and owners.',
      ],
    }),
  ),

  domain: guide(
    'Data domains',
    sections4({
      about: [
        'Maintains enterprise business domain codes and names (e.g. trade, user, goods).',
        'Metrics, Catalog, and Standards dropdowns all read from this module for consistent scope.',
      ],
      ops: [
        'Create a domain with a lowercase code and display name.',
        'Disable a domain only after confirming no references; it disappears from dropdowns immediately.',
        'After renaming, refresh Metrics / Catalog / Standards to verify display.',
      ],
      example:
        'Scenario: add Marketing\nCode: marketing\nName: Marketing\nAfter save, the Metrics create form should list Marketing in the domain dropdown',
      next: [
        'Filter or register assets by domain in Catalog.',
        'Organize metrics by domain in Metrics Center.',
        'Maintain standard fields and codes for the domain.',
      ],
    }),
  ),

  catalog: guide(
    'Asset Catalog',
    sections4({
      about: [
        'Unified registry of lake assets by layer and business domain.',
        'Lists follow the current workspace. Visibility does not imply query access; preview and read require ownership or an approved grant.',
      ],
      ops: [
        'Filter by source, layer, and domain on the left; browse assets on the right.',
        'Register a new asset: pick source table, set layer and domain, then submit.',
        'Open details for schema, quality, and lineage entry points.',
        'Export the current filtered list when needed.',
      ],
      example:
        'Scenario: register a trade detail asset\nSource: trading DB / s_order\nLayer: DWD · Trade\nSubmit, then verify fields and quality entry in the detail drawer',
      next: [
        'Review upstream/downstream impact in Lineage.',
        'Check field and code alignment in Standards.',
        'Trial queries in Ad-hoc Query (if authorized).',
        'Request read access for colleagues in Apply Center.',
        'Bind the asset in Data Services or Metrics.',
      ],
    }),
  ),

  standard: guide(
    'Data Standards',
    sections4({
      about: [
        'Defines enterprise semantics: standard fields, code sets, naming rules, source-to-standard maps, and conformance results.',
        'Fields and codes are referenced by modeling and cleansing; conformance checks verify landed tables remain compliant.',
      ],
      ops: [
        'Create or maintain definitions under Standard fields / Code sets.',
        'Review or maintain conversion rules under Source-to-standard maps.',
        'Inspect landed-table compliance under Conformance.',
        'Maintain naming templates for tables, jobs, and metrics.',
      ],
      example:
        'Scenario: order-status semantics\n1. Create a code set with status meanings\n2. Map source fields to the standard field\n3. Apply the dictionary in ETL cleansing\n4. Confirm compliance; alert or block on drift',
      next: [
        'Reference code sets in ETL mapping nodes.',
        'Author compliant cleansing logic in Data Dev.',
        'Add matching inspection rules in Data Quality.',
        'Verify asset field alignment in Catalog.',
      ],
    }),
  ),

  integration: guide(
    'ETL Orchestration',
    sections4({
      about: [
        'Design ingest, transform, and export jobs on a visual canvas with drag-and-drop operators and wiring.',
        'Jobs may bind registered datasources; mappings may reference standards; export sinks require an approved export ticket.',
      ],
      ops: [
        'Open an existing job or create a new one.',
        'Drag operators onto the canvas and arrange them.',
        'Connect output ports to input ports.',
        'Configure sources, SQL, standard references, and sinks on the right.',
        'Validate first, then save or publish.',
      ],
      example:
        'Scenario: order ingest path\nExtract → land in lake → cleanse & map standards → quality gate → aggregate / export\nValidate, save, then monitor in Job Ops',
      next: [
        'Monitor runs in Job Ops.',
        'Confirm target tables in Catalog.',
        'Sync and review flow in Lineage.',
        'Configure gates in Data Quality.',
        'For export: approve a ticket in Apply Center and fill the ticket id.',
      ],
    }),
  ),

  lineage: guide(
    'Lineage',
    sections4({
      about: [
        'Shows end-to-end table and field flow, with focus-asset upstream/downstream views and change-impact assessment.',
        'Edges primarily come from ETL field maps and can be refreshed on demand for change review, quality tracing, and audit.',
      ],
      ops: [
        'Select a focus asset to highlight the graph and lists.',
        'Open field-level impact for a column change.',
        'Click Sync after ETL changes to refresh edges.',
        'Export the graph when documentation is required.',
      ],
      example:
        'Scenario: assess an amount-column type change\n1. Open lineage on the detail table\n2. Select the amount field and list downstream aggregates/reports\n3. Plan remediation; block high-risk changes if needed',
      next: [
        'Open related assets in Catalog.',
        'Adjust mappings in Standards if required.',
        'Assess delete propagation in Compliance Delete.',
        'Combine with Root Cause for quality or recon incidents.',
      ],
    }),
  ),

  lifecycle: guide(
    'Lifecycle',
    sections4({
      about: [
        'Manages hot/warm/cold tiering, snapshot retention, compaction, and orphan cleanup to control cost and retention.',
        'Subject erase must go through Compliance Delete; growth analysis is available in Storage Trends.',
      ],
      ops: [
        'Review tier levels and tables needing action.',
        'Adjust retention days or compaction cadence in policies.',
        'Run snapshot expiry or compaction on a selected table and confirm the run.',
        'Open Storage Trends for growth analysis.',
      ],
      example:
        'Scenario: too many small files on a detail table\n1. Locate the table in the action list\n2. Run compaction and record the result\n3. Confirm active storage decline in Storage Trends',
      next: [
        'Check expansion risk in Storage Trends.',
        'Open Compliance Delete for subject or partition erase.',
        'Verify daily lifecycle jobs in Job Ops.',
        'Review governance tags on assets in Catalog.',
      ],
    }),
  ),

  compliance: guide(
    'Compliance Delete',
    sections4({
      about: [
        'Handles irreversible deletes for right-to-be-forgotten, bad loads, regulatory orders, and contract expiry.',
        'Flow: create → impact review → approve → execute → archive → physical destroy. Confirm scope carefully; rollback windows are limited.',
      ],
      ops: [
        'Create a ticket with subject, type, scope, and approvers.',
        'Filter by status and open details for timeline and impacted tables.',
        'Approve or reject; execute when ready.',
        'Destroy after the archive period; jump to Lineage for impact tables.',
      ],
      example:
        'Scenario: right to be forgotten\n1. Create a ticket with subject and scope\n2. Review impacted tables and lineage\n3. Complete security / legal / owner approval\n4. Execute, retain evidence, then destroy when due',
      next: [
        'Re-check impact in Lineage.',
        'Review retention policies in Lifecycle.',
        'Confirm execution window jobs in Job Ops.',
        'Review related approvals in Apply Center.',
      ],
    }),
  ),

  'storage-trend': guide(
    'Storage Trends',
    sections4({
      about: [
        'Read-only analysis of lake storage: physical/active/reclaimable views, window trends, bucket levels, and abnormal tables.',
        'Governance actions are not executed here; compact/expire jumps to Lifecycle for confirmation and audit.',
      ],
      ops: [
        'Switch 7 / 30 / 90 day windows for trends.',
        'Compare workspace quota share; open Workspaces if needed.',
        'Choose compact or expire on an abnormal table, then confirm in Lifecycle.',
      ],
      example:
        'Scenario: a workspace nears quota\n1. Use the last 30 days to find fast-growing tables\n2. Expire or compact cold data in Lifecycle\n3. Return here to verify reclaimable volume and quota share',
      next: [
        'Execute compact/expire in Lifecycle.',
        'Adjust quotas or ownership in Workspaces.',
        'Review scan/storage cost in Query & Cost Gov.',
        'Locate table owners in Catalog.',
      ],
    }),
  ),

  develop: guide(
    'Data Dev / SQL',
    sections4({
      about: [
        'Online workbench to author and trial SQL/job scripts with resource tree, helpers, lint, and trial runs.',
        'Trial in test/pre environments; production promotion goes through Env & Release. Do not hot-edit production SQL in the scheduler.',
      ],
      ops: [
        'Open or create a script in the tree.',
        'Select engine and environment.',
        'Edit SQL; insert platform functions from the right panel.',
        'Format and trial-run; review results and logs.',
        'Submit for release when the trial succeeds.',
      ],
      example:
        'Scenario: detail cleansing logic\n1. Create a script referencing standard codes\n2. Trial in test and verify sample rows/masking\n3. Submit for pre/prod release approval',
      next: [
        'Track gates and outcomes in Env & Release.',
        'Spot-check in Ad-hoc Query if authorized.',
        'Add rules for output tables in Data Quality.',
        'Verify output flow in Lineage.',
      ],
    }),
  ),

  query: guide(
    'Ad-hoc Query',
    sections4({
      about: [
        'Run temporary SQL on authorized lake assets with catalog pick, edit, governed execution, and export.',
        'Results are masked by policy; unconstrained full scans may be blocked. Request access in Apply Center when denied.',
      ],
      ops: [
        'Click a table on the left to insert sample SQL.',
        'Edit and execute (or use the shortcut).',
        'Review row count, duration, masking, and row filters.',
        'Export masked CSV or save as a dataset.',
        'Follow prompts to Apply Center on denial or over-limit.',
      ],
      example:
        'Scenario: validate dashboard logic\n1. Insert a sample query on an aggregate table and add filters\n2. Confirm sensitive columns are masked\n3. Export masked CSV or save as a dataset',
      next: [
        'Request table/column access or scan elevate in Apply Center.',
        'Review queues and cost in Query & Cost Gov.',
        'Harden stable SQL in Data Dev.',
        'Package frequent access as APIs in Data Services.',
      ],
    }),
  ),

  publish: guide(
    'Env & Release',
    sections4({
      about: [
        'Manages multi-environment isolation and release gates so scripts promote in a controlled way.',
        'Gates typically include compile, lineage, quality, pre trial, and change impact. Rollback points to a prior version tag; do not edit production SQL in the scheduler.',
      ],
      ops: [
        'Submit from Data Dev or create a release here.',
        'Review gate results under Release gates.',
        'Check version, environment, and outcome in Recent releases.',
        'If blocked, fix in Data Dev and resubmit.',
      ],
      example:
        'Scenario: promote an aggregate script to production\n1. Pre trial and quality gates pass\n2. Provide a rollback plan and submit\n3. After approval, go live; roll back by plan if needed',
      next: [
        'Watch post-release jobs in Job Ops.',
        'Confirm related rules in Data Quality.',
        'Re-check change impact in Lineage.',
        'Review release approvals in Apply Center.',
      ],
    }),
  ),

  quality: guide(
    'Data Quality',
    sections4({
      about: [
        'Configure quality rules, review inspection runs, and alert or block downstream jobs on failure.',
        'Rules bind to tables registered in Catalog and may align with Standards conformance results.',
      ],
      ops: [
        'Confirm the target table exists in Catalog.',
        'Create a rule: choose type, bind table/columns, set thresholds and action, then submit.',
        'Review pass/fail details in run history.',
        'Sync external quality profiles when needed.',
      ],
      example:
        'Scenario: null and uniqueness checks on a detail table\n1. Create NOT NULL / uniqueness rules on key columns\n2. Set failure to block downstream DAGs\n3. On failure, confirm stops in Job Ops and fix the source',
      next: [
        'Align codes and types in Standards.',
        'Handle blocked jobs in Job Ops.',
        'Investigate jointly in Root Cause.',
        'Include quality gates in Env & Release.',
      ],
    }),
  ),

  security: guide(
    'Security & Access',
    sections4({
      about: [
        'Manages row/column grants, dynamic masking, secret custody, and access audit.',
        'Human access goes through governed query; writes use job service accounts. Catalog visibility is not engine access.',
      ],
      ops: [
        'Configure masking policies for sensitive columns.',
        'Grant table/column access to roles or users.',
        'Manage job service accounts and scopes.',
        'Review access audit for sensitive activity.',
      ],
      example:
        'Scenario: mask phone numbers and grant analyst read\n1. Add dynamic masking on phone columns\n2. Grant aggregate-layer read to analysts\n3. Verify masking in Ad-hoc Query and sample the audit log',
      next: [
        'Process access and sensitive-clear requests in Apply Center.',
        'Verify masking and row filters in Ad-hoc Query.',
        'Configure API auth and rate limits in Data Services.',
        'Manage collaboration members in Workspaces (membership ≠ read access).',
      ],
    }),
  ),

  contract: guide(
    'Data Contracts',
    sections4({
      about: [
        'Agreements between producers and consumers on schema, compatibility, and SLA.',
        'Structural changes require review; incompatibilities and breaches are trackable to reduce cross-team conflicts.',
      ],
      ops: [
        'Create a contract and bind assets.',
        'Invite consumers to confirm.',
        'Open a review ticket for structural changes and record the decision.',
        'Track SLA attainment and breaches.',
      ],
      example:
        'Scenario: add an optional column on a detail table\n1. Record compatibility rules in the contract\n2. After review, upgrade jobs before altering the table\n3. Notify downstream consumers to adapt',
      next: [
        'Verify bound assets in Catalog.',
        'Sync field semantics in Standards.',
        'Assess API response impact in Data Services.',
        'Complete related approvals in Apply Center.',
      ],
    }),
  ),

  dataservice: guide(
    'Data Services',
    sections4({
      about: [
        'Packages tables or metrics as stable APIs for business systems, avoiding direct warehouse connections.',
        'Main path: project datasource → build and trial → publish → serve via the unified gateway; the portal owns bindings and publish state.',
      ],
      ops: [
        'Confirm the datasource is projected.',
        'Build an API, select a source, write SQL/script, and trial-run.',
        'Publish and bind assets or metrics.',
        'Share the gateway URL; issue keys via Apply Center.',
      ],
      example:
        'Scenario: order aggregate API for a business system\n1. Project the source, build the API, trial successfully\n2. Publish and bind the related metric/asset\n3. Caller applies for a key and invokes via the gateway',
      next: [
        'Handle API publish/call tickets in Apply Center.',
        'Bind consistent metrics in Metrics Center.',
        'Monitor success rate and latency in Call Trace.',
        'Watch related cost and quotas in Query & Cost Gov.',
      ],
    }),
  ),

  metrics: guide(
    'Metrics Center',
    sections4({
      about: [
        'Unifies metric names and business definitions across atomic, derived, and composite types.',
        'Lifecycle: draft → publish request → active; then request query access or definition change. An empty catalog is valid.',
      ],
      ops: [
        'Create a metric, save as draft, and verify definition and bound tables.',
        'Apply to publish; approval activates the metric.',
        'Request query access from list/detail into Apply Center.',
        'For definition changes on active metrics, submit a change request for a formal version bump.',
      ],
      example:
        'Scenario: launch a GMV metric\n1. Define an atomic metric bound to detail columns\n2. Save draft, apply to publish, activate after approval\n3. Business users request query access for dashboards',
      next: [
        'Track publish/access/change tickets in Apply Center.',
        'Expose the metric as an API in Data Services.',
        'Review related summaries on Overview.',
        'Align units and naming in Standards.',
      ],
    }),
  ),

  export: guide(
    'Export & Reverse ETL',
    sections4({
      about: [
        'Syncs lake data to external systems (business DBs, files, search). An approved export request is required first.',
        'After approval, fill the ticket id on the ETL export node before masking and scheduling. Personal ad-hoc dumps into production are prohibited.',
      ],
      ops: [
        'Submit an export request with table, purpose, target, and validity.',
        'After approval in Apply Center, copy the ticket id.',
        'Fill the ticket on the ETL export node; configure masking and schedule.',
        'Monitor job status, expiry, and reclaim on this page.',
      ],
      example:
        'Scenario: daily order aggregate back to a business DB\n1. Apply for export with reverse-ETL purpose and validity\n2. After approval, fill the ticket id in ETL\n3. Configure static masking and schedule; monitor expiry here',
      next: [
        'Review export approvals in Apply Center.',
        'Maintain export jobs in ETL Orchestration.',
        'Handle failed runs in Job Ops.',
        'Verify masking and service accounts in Security.',
      ],
    }),
  ),

  apply: guide(
    'Apply Center',
    sections4({
      about: [
        'Unified intake and approval for access, export, release, API, and metrics requests.',
        'After approval, grants take effect or ticket ids / API credentials are issued. Requesters and approvers collaborate in one place.',
      ],
      ops: [
        'Create an application and choose the type.',
        'Select assets, scope, and validity; submit with a clear purpose.',
        'Track progress under My requests; approvers act in Pending for me.',
        'Follow post-approval guidance: query, fill export ticket id, or retrieve an API key.',
      ],
      example:
        'Scenario: request read-only access to an aggregate table\n1. Choose table read-only and select assets/columns\n2. After owner approval, access takes effect\n3. Verify in Ad-hoc Query; sensitive columns remain masked',
      next: [
        'Use authorized assets in Ad-hoc Query or Data Dev.',
        'For export: fill the ticket id in ETL.',
        'For API: use issued credentials in Data Services.',
        'For release: confirm outcomes in Env & Release.',
      ],
    }),
  ),

  ops: guide(
    'Job Ops',
    sections4({
      about: [
        'Unified view of streaming and batch runs, lake recon results, and backfill tickets.',
        'Failed jobs can jump to Root Cause or Data Quality; on recon failure, re-import to the accelerate layer defaults to the lake table as source of truth.',
      ],
      ops: [
        'Review failed job cards and recent runs.',
        'Open Root Cause for recon failures.',
        'Start a backfill or re-import for a differing partition.',
        'Refresh status after remediation.',
      ],
      example:
        'Scenario: batch failure causes recon mismatch\n1. Locate the failed job and time window\n2. Correlate quality and trace evidence in Root Cause\n3. Backfill, rerun recon, and confirm the gap is closed',
      next: [
        'Complete evidence-based triage in Root Cause.',
        'Handle delist/recover in Reliability.',
        'Review gate rules in Data Quality.',
        'Replay failed calls in Call Trace.',
      ],
    }),
  ),

  linktrace: guide(
    'Call Trace',
    sections4({
      about: [
        'Replays business call paths across hops to locate latency and failures.',
        'Search by call identifiers; drill into failed or slow hops and continue in Root Cause when needed.',
      ],
      ops: [
        'Select a business chain and open the timeline.',
        'Click a failed or slow hop for errors and context.',
        'Continue in Root Cause for cross-module triage.',
      ],
      example:
        'Scenario: recon chain latency rises\n1. Open the chain and find the slowest hop\n2. Inspect error codes and dependencies\n3. Continue in Root Cause with job and quality evidence',
      next: [
        'Summarize evidence in Root Cause.',
        'Rerun or backfill in Job Ops.',
        'Check resource alerts in Infra Monitor.',
        'Inspect API anomalies in Data Services.',
      ],
    }),
  ),

  infra: guide(
    'Infra Monitor',
    sections4({
      about: [
        'Shows node resources, container/platform health, alerts, and capacity suggestions.',
        'An empty list is valid before collection is connected; do not rely on demo data.',
      ],
      ops: [
        'Review node health and resource levels.',
        'Handle infrastructure alerts by priority.',
        'Follow capacity suggestions and assess business impact in related modules.',
      ],
      example:
        'Scenario: disk watermark alert\n1. Locate high-watermark hosts\n2. Correlate with Storage Trends for data growth\n3. Compact/expire in Lifecycle or request expansion per process',
      next: [
        'Analyze growth in Storage Trends.',
        'Execute compact/expire in Lifecycle.',
        'Assess impact in Call Trace.',
        'Review HA/backup posture in Reliability.',
      ],
    }),
  ),

  rootcause: guide(
    'Root Cause',
    sections4({
      about: [
        'Correlates job status, quality, lineage, and trace evidence to explain incidents and suggest remediation.',
        'Stays empty without sufficient evidence; start from real alerts or recon failures—no unfounded one-click success.',
      ],
      ops: [
        'Enter from an alert, recon failure, or trace anomaly.',
        'Drill along the evidence chain into jobs, quality, or traces.',
        'Follow suggestions to backfill, degrade, or open external tickets.',
      ],
      example:
        'Scenario: quality drop with recon failure\n1. Open quality and recon evidence in the same window\n2. Trace upstream via lineage to a suspect table or job\n3. Backfill, rerun recon, and confirm recovery',
      next: [
        'Backfill or rerun in Job Ops.',
        'Delist/recover in Reliability.',
        'Adjust or recheck rules in Data Quality.',
        'Confirm blast radius closure in Lineage.',
      ],
    }),
  ),

  reliability: guide(
    'Reliability',
    sections4({
      about: [
        'Summarizes HA/backup posture, recon rules, and delist → re-import → recover loops after recon failure.',
        'Used for drills, mismatch handling, and restoring readiness of critical data products.',
      ],
      ops: [
        'Review HA and backup summaries.',
        'Browse recon rules and history; drill into diffs.',
        'Delist on failure; after fix, re-import and restore ready state.',
      ],
      example:
        'Scenario: recon failure makes a dashboard unsafe\n1. Delist related assets to stop bad results\n2. Re-import from the lake table and rerun recon\n3. Restore ready state and notify consumers',
      next: [
        'Track re-import/backfill in Job Ops.',
        'Archive incident evidence in Root Cause.',
        'Check resource causes in Infra Monitor.',
        'Confirm external APIs in Data Services.',
      ],
    }),
  ),

  querygov: guide(
    'Query & Cost Gov',
    sections4({
      about: [
        'Manages query queues and scan limits, audits heavy queries, and allocates storage/scan cost by workspace.',
        'Rules align with ad-hoc execution to prevent unconstrained full scans from consuming shared capacity.',
      ],
      ops: [
        'Review queue concurrency and backlog.',
        'Locate over-limit or high-scan queries in audit.',
        'Pick range and workspace to view cost and export.',
        'Maintain federation mappings and limit rules per on-page guidance.',
      ],
      example:
        'Scenario: a workspace scan cost spikes\n1. Select the workspace and last 30 days\n2. Find heavy statements and owners in audit\n3. Drive optimization or a justified elevate; recheck the cost curve',
      next: [
        'Verify limits in Ad-hoc Query.',
        'Request scan elevate in Apply Center.',
        'Review quotas in Workspaces.',
        'Govern costly tables in Lifecycle.',
      ],
    }),
  ),

  workspace: guide(
    'Workspaces',
    sections4({
      about: [
        'Team work surfaces. Switching the current workspace refreshes catalog and related lists for that plane.',
        'Membership is collaboration identity only—not data read access. Reads and export still require Apply Center grants.',
      ],
      ops: [
        'Create or select a team workspace.',
        'Switch via the top bar; related lists refresh.',
        'Invite members and assign collaboration roles.',
        'Owners may maintain linked repository info (UI shows redacted values only).',
      ],
      example:
        'Scenario: create a project workspace\n1. Create the space and invite developers/analysts\n2. Members request required table access in Apply Center\n3. After switching space, lists show this workspace’s context',
      next: [
        'Request read access in Apply Center.',
        'Browse assets for this space in Catalog.',
        'Review cost for this space in Query & Cost Gov.',
        'Work in Data Dev / Ad-hoc Query under this context.',
      ],
    }),
  ),

  aiassistant: guide(
    'AI Assistant',
    sections4({
      about: [
        'Conversational help to find assets, draft SQL, explain structures, and troubleshoot, with Knowledge Base citations.',
        'Prefers the current workspace’s assets and knowledge as soft context; execution remains ACL-bound.',
      ],
      ops: [
        'Confirm the current workspace in the top bar.',
        'Use a quick chip or describe the need directly.',
        'Validate recommended assets or SQL before adopting.',
        'Jump to Data Dev or Ad-hoc Query to continue editing.',
      ],
      example:
        'Scenario: locate order-related tables and draft a query\n1. Describe the business question and fields needed\n2. Confirm recommended assets\n3. Jump to Ad-hoc Query to refine and run',
      next: [
        'Enrich Knowledge Base for better answers.',
        'Switch models in AI Models.',
        'Harden validated SQL in Data Dev.',
        'Request missing table access in Apply Center.',
      ],
    }),
  ),

  aimodel: guide(
    'AI Models',
    sections4({
      about: [
        'Registers model endpoints, purpose, and pricing for the assistant to switch among, with usage visibility.',
        'Keep keys secure; verify availability in the assistant after endpoint or price changes.',
      ],
      ops: [
        'Add a model with endpoint, key, context, and unit prices.',
        'Edit purpose or pricing on the card.',
        'Switch models in the AI assistant and verify.',
        'Review usage by workspace for cost control.',
      ],
      example:
        'Scenario: onboard a new chat model\n1. Register endpoint and key; set purpose to assistant chat\n2. Switch to it in the AI assistant and trial a question\n3. Roll out after confirming responses',
      next: [
        'Switch and verify in the AI assistant.',
        'Configure embedding models for Knowledge Base ingest.',
        'Watch related cost in Query & Cost Gov or Workspaces.',
      ],
    }),
  ),

  knowledge: guide(
    'Knowledge Base',
    sections4({
      about: [
        'Stores handbooks, modeling standards, and domain knowledge for search and AI citations.',
        'Entries are global (not workspace-isolated). Ingest via short text or document upload.',
      ],
      ops: [
        'Create an entry by text or upload.',
        'Configure chunking/embedding and run ingest.',
        'Search the list; link related standards or assets.',
        'Let the AI assistant cite ingested content in answers.',
      ],
      example:
        'Scenario: publish an ingest handbook for onboarding\n1. Upload the document and complete vector ingest\n2. Confirm it is searchable in the list\n3. Newcomers ask the assistant and receive cited answers',
      next: [
        'Verify citations in the AI assistant.',
        'Link related entries from Standards.',
        'Confirm embedding models in AI Models.',
        'Refresh outdated documents to avoid wrong citations.',
      ],
    }),
  ),
}
