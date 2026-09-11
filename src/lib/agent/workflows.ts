import { validateAgentCommand } from "@/lib/agent/workspace-tools";

/**
 * R16: named, parameterised workflows, so a repeated job stops being a
 * free-text prompt written differently every time.
 *
 * A Run is currently described by whatever the user typed. That is fine for a
 * one-off and wrong for a chore done weekly: the task wording drifts, the
 * acceptance criteria drift with it, and two Runs of "the same" job are not
 * comparable. A template fixes the prompt shape, the criteria and the
 * verification commands, so the only thing that varies between Runs is the
 * parameters — which is what makes outcomes comparable and the job auditable.
 *
 * ## Why API migration is the first one
 *
 * The three candidates were API migrations, dependency upgrades and security
 * remediations. Two of them cannot be built without weakening a deliberate
 * policy, so they are deliberately not offered:
 *
 *   - **Dependency upgrades** require editing package.json and a lockfile.
 *     `classifySensitivePath` classes both as "package manifest or lockfile",
 *     `canWrite` refuses them, and `AgentSlice.widen` refuses to open them.
 *     That is the supply-chain guard working as designed; a template that asks
 *     the Agent to do it would fail every time, or force the guard open.
 *   - **Security remediations** usually land on paths matching the
 *     "authentication or security code" class, with the same result.
 *
 * API migration touches ordinary source: call sites moving from an old API to a
 * new one. It works within the policy rather than against it, which is why it
 * ships first. The other two need an elevated-review path to exist before they
 * are honest to offer.
 */

export type WorkflowParameter = {
  name: string;
  label: string;
  /** Shown to the operator; also becomes part of the generated task text. */
  description: string;
  required: boolean;
  maxLength: number;
  example: string;
};

export type WorkflowPlan = {
  workflowId: string;
  task: string;
  /** One criterion per entry, matching parseAgentRunRequest's contract. */
  acceptanceCriteria: string[];
  /** Verification commands, each already checked against the allowlist. */
  checks: string[];
};

export type WorkflowTemplate = {
  id: string;
  title: string;
  summary: string;
  parameters: WorkflowParameter[];
  build(values: Record<string, string>): WorkflowPlan;
};

export class WorkflowInputError extends Error {}

function read(
  values: Record<string, string>,
  parameter: WorkflowParameter,
): string {
  const raw = values[parameter.name];
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    if (parameter.required) {
      throw new WorkflowInputError(`${parameter.label} is required.`);
    }
    return "";
  }
  if (value.length > parameter.maxLength) {
    throw new WorkflowInputError(
      `${parameter.label} must be ${parameter.maxLength} characters or fewer.`,
    );
  }
  // Newlines would let a parameter forge structure in the generated task, which
  // is the prompt the model reads. A parameter is a value, not a section.
  if (/[\n\r]/.test(value)) {
    throw new WorkflowInputError(`${parameter.label} must be a single line.`);
  }
  return value;
}

const API_MIGRATION_PARAMETERS: WorkflowParameter[] = [
  {
    name: "fromApi",
    label: "Current API",
    description: "The call being migrated away from",
    required: true,
    maxLength: 200,
    example: "createClient(url, key)",
  },
  {
    name: "toApi",
    label: "Replacement API",
    description: "The call that replaces it",
    required: true,
    maxLength: 200,
    example: "createClient({ url, key })",
  },
  {
    name: "rationale",
    label: "Why",
    description: "What breaks or improves once this migration lands",
    required: true,
    maxLength: 500,
    example: "the positional signature is removed in v3",
  },
  {
    name: "notes",
    label: "Constraints",
    description: "Anything the migration must preserve or avoid",
    required: false,
    maxLength: 500,
    example: "keep the retry wrapper in place",
  },
];

/**
 * Verification for a migration is the same question every time: does the code
 * still typecheck, lint and pass its tests after every call site moved? Fixing
 * the commands here is the point — an operator choosing different checks per
 * Run is how two Runs of the same job stop being comparable.
 */
const API_MIGRATION_CHECKS = ["pnpm lint", "pnpm test"];

const apiMigration: WorkflowTemplate = {
  id: "api-migration",
  title: "API migration",
  summary:
    "Move every call site from one API to another, leaving behaviour unchanged.",
  parameters: API_MIGRATION_PARAMETERS,
  build(values) {
    const fromApi = read(values, API_MIGRATION_PARAMETERS[0]);
    const toApi = read(values, API_MIGRATION_PARAMETERS[1]);
    const rationale = read(values, API_MIGRATION_PARAMETERS[2]);
    const notes = read(values, API_MIGRATION_PARAMETERS[3]);

    if (fromApi === toApi) {
      throw new WorkflowInputError(
        "The current and replacement APIs are identical; there is nothing to migrate.",
      );
    }

    const task = [
      `Migrate every call site from \`${fromApi}\` to \`${toApi}\`.`,
      "",
      `Why: ${rationale}`,
      notes ? `Constraints: ${notes}` : "",
      "",
      "Change call sites only. Behaviour must be identical before and after:",
      "this is a mechanical migration, not a refactor and not a bug fix. If a",
      "call site cannot be migrated without changing behaviour, leave it alone",
      "and say so in the summary rather than guessing.",
    ].filter(Boolean).join("\n");

    const acceptanceCriteria = [
      `No remaining call site uses \`${fromApi}\`.`,
      `Every migrated call site uses \`${toApi}\` with equivalent arguments.`,
      "No behavioural change: no new branches, no changed defaults, no altered error handling.",
      "Any call site left unmigrated is named in the summary with the reason.",
      "Lint and the test suite pass.",
    ];

    return {
      workflowId: apiMigration.id,
      task,
      acceptanceCriteria,
      // Validated rather than trusted: a template is code, and a template that
      // emitted a command outside the allowlist would fail deep inside a Run
      // instead of here.
      checks: API_MIGRATION_CHECKS.map((command) => validateAgentCommand(command)),
    };
  },
};

const TEMPLATES: ReadonlyArray<WorkflowTemplate> = Object.freeze([apiMigration]);

export function listWorkflowTemplates(): ReadonlyArray<WorkflowTemplate> {
  return TEMPLATES;
}

export function findWorkflowTemplate(id: string): WorkflowTemplate | null {
  return TEMPLATES.find((template) => template.id === id) ?? null;
}

/**
 * Build a Run plan from a template id and its parameters.
 *
 * Throws WorkflowInputError with a message meant for the operator, so the API
 * can answer 400 with something actionable rather than a generic failure.
 */
export function planWorkflowRun(
  workflowId: string,
  values: Record<string, string>,
): WorkflowPlan {
  const template = findWorkflowTemplate(workflowId);
  if (!template) {
    const known = TEMPLATES.map((entry) => entry.id).join(", ");
    throw new WorkflowInputError(`Unknown workflow: ${workflowId}. Known workflows: ${known}`);
  }
  return template.build(values);
}
