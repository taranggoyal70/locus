import {
  AgentScope,
  truncateToolOutput,
  validateAgentCommand,
  validateRepoPath,
  type AgentScopeLedger,
} from "@/lib/agent/workspace-tools";

export type AgentWorkspaceCommand = {
  command: string;
  workingDirectory?: string;
  env?: Record<string, string>;
  abortSignal?: AbortSignal;
  timeoutMs?: number;
};

export type AgentWorkspaceResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export interface AgentWorkspace {
  readonly id: string;
  readonly description: string;
  run(command: AgentWorkspaceCommand): Promise<AgentWorkspaceResult>;
  stop(): Promise<void>;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function evidence(result: AgentWorkspaceResult): string {
  const streams = [
    `exit ${result.exitCode}`,
    result.stdout.trim() && `stdout:\n${result.stdout.trim()}`,
    result.stderr.trim() && `stderr:\n${result.stderr.trim()}`,
  ].filter(Boolean);
  return truncateToolOutput(streams.join("\n\n"));
}

const WRITE_SCRIPT = [
  'const fs=require("node:fs");',
  'const path=require("node:path");',
  "const target=process.env.LOCUS_PATH;",
  "const content=process.env.LOCUS_CONTENT;",
  'if(!target||content===undefined)throw new Error("missing write input");',
  "fs.mkdirSync(path.dirname(target),{recursive:true});",
  "fs.writeFileSync(target,content);",
  'process.stdout.write(`wrote ${target}\\n`);',
].join("");

const REPLACE_SCRIPT = [
  'const fs=require("node:fs");',
  "const target=process.env.LOCUS_PATH;",
  "const before=process.env.LOCUS_BEFORE;",
  "const after=process.env.LOCUS_AFTER;",
  'if(!target||before===undefined||after===undefined)throw new Error("missing replace input");',
  'const source=fs.readFileSync(target,"utf8");',
  "const count=source.split(before).length-1;",
  'if(count!==1){console.error(`expected exactly one match, found ${count}`);process.exit(2);}',
  "fs.writeFileSync(target,source.replace(before,after));",
  'process.stdout.write(`updated ${target}\\n`);',
].join("");

const READ_BASE64_SCRIPT = [
  'const fs=require("node:fs");',
  "const target=process.env.LOCUS_PATH;",
  'if(!target)throw new Error("missing read input");',
  'process.stdout.write(fs.readFileSync(target).toString("base64"));',
].join("");

export type AgentChange = {
  path: string;
  content: string | null;
};

export class WorkspaceController {
  constructor(
    private readonly workspace: AgentWorkspace,
    private readonly scope: AgentScope,
  ) {}

  ledger(): AgentScopeLedger {
    return this.scope.ledger();
  }

  listFiles(): AgentScopeLedger {
    return this.scope.ledger();
  }

  async readFile(input: string, abortSignal?: AbortSignal): Promise<string> {
    const path = validateRepoPath(input);
    if (!this.scope.canRead(path)) {
      throw new Error(`${path} is outside the active Slice`);
    }
    const result = await this.workspace.run({
      command: `sed -n '1,320p' -- ${shellQuote(path)}`,
      abortSignal,
      timeoutMs: 30_000,
    });
    return evidence(result);
  }

  async widenFile(input: string, abortSignal?: AbortSignal): Promise<string> {
    const path = this.scope.widen(input);
    return this.readFile(path, abortSignal);
  }

  async search(query: string, abortSignal?: AbortSignal): Promise<string> {
    const term = query.trim().slice(0, 300);
    if (!term) throw new Error("Search query is required");
    const paths = this.scope.readablePaths();
    if (paths.length === 0) return "No readable files in the active Slice.";
    const args = paths.map(shellQuote).join(" ");
    const result = await this.workspace.run({
      command: `rg -n --fixed-strings -- ${shellQuote(term)} ${args}`,
      abortSignal,
      timeoutMs: 30_000,
    });
    return evidence(result);
  }

  async replaceText(
    input: string,
    before: string,
    after: string,
    abortSignal?: AbortSignal,
  ): Promise<string> {
    const path = validateRepoPath(input);
    if (!this.scope.canWrite(path)) {
      throw new Error(`${path} is outside the active Slice`);
    }
    if (!before || before.length > 30_000 || after.length > 30_000) {
      throw new Error("Replacement text must be between 1 and 30,000 characters");
    }
    const result = await this.workspace.run({
      command: `node -e ${shellQuote(REPLACE_SCRIPT)}`,
      env: {
        LOCUS_PATH: path,
        LOCUS_BEFORE: before,
        LOCUS_AFTER: after,
      },
      abortSignal,
      timeoutMs: 30_000,
    });
    return evidence(result);
  }

  async writeFile(input: string, content: string, abortSignal?: AbortSignal): Promise<string> {
    const path = validateRepoPath(input);
    if (!this.scope.canWrite(path)) this.scope.create(path);
    if (content.length > 50_000) throw new Error("File content exceeds the 50,000 character limit");
    const result = await this.workspace.run({
      command: `node -e ${shellQuote(WRITE_SCRIPT)}`,
      env: { LOCUS_PATH: path, LOCUS_CONTENT: content },
      abortSignal,
      timeoutMs: 30_000,
    });
    return evidence(result);
  }

  async runCheck(input: string, abortSignal?: AbortSignal): Promise<string> {
    const command = validateAgentCommand(input);
    const result = await this.workspace.run({
      command,
      abortSignal,
      timeoutMs: 300_000,
    });
    return evidence(result);
  }

  async diff(abortSignal?: AbortSignal): Promise<string> {
    const result = await this.workspace.run({
      command: "git diff --no-ext-diff -- .",
      abortSignal,
      timeoutMs: 30_000,
    });
    return evidence(result);
  }

  async changeSet(abortSignal?: AbortSignal): Promise<AgentChange[]> {
    const names = await this.workspace.run({
      command: "git diff --name-status --diff-filter=AMD -- .",
      abortSignal,
      timeoutMs: 30_000,
    });
    if (names.exitCode !== 0) throw new Error("Could not enumerate changed files");

    const changes = names.stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [status, ...pathParts] = line.split("\t");
        return { status, path: validateRepoPath(pathParts.join("\t")) };
      });
    if (changes.length > 30) throw new Error("Agent change set exceeds the 30 file limit");

    let totalCharacters = 0;
    const output: AgentChange[] = [];
    for (const change of changes) {
      if (!this.scope.canWrite(change.path)) {
        throw new Error(`${change.path} changed outside the active Slice`);
      }
      if (change.status === "D") {
        output.push({ path: change.path, content: null });
        continue;
      }

      const result = await this.workspace.run({
        command: `node -e ${shellQuote(READ_BASE64_SCRIPT)}`,
        env: { LOCUS_PATH: change.path },
        abortSignal,
        timeoutMs: 30_000,
      });
      if (result.exitCode !== 0) throw new Error(`Could not capture ${change.path}`);
      const content = Buffer.from(result.stdout.trim(), "base64").toString("utf8");
      totalCharacters += content.length;
      if (content.length > 200_000 || totalCharacters > 1_500_000) {
        throw new Error("Agent change set exceeds the delivery size limit");
      }
      output.push({ path: change.path, content });
    }
    return output;
  }
}
