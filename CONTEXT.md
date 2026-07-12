# Locus

This context defines the language for selecting the smallest safe codebase context an AI coding agent needs for a task.

## Language

**Codebase**:
The repository snapshot Locus analyzes. A Codebase is identified by its files and import relationships, not by a chat transcript.
_Avoid_: Workspace, prompt, generated summary

**Task Intent**:
The user's natural-language description of the change or investigation they want an agent to perform.
_Avoid_: Search query, file name, implementation plan

**Entry Point**:
A route, component, command, or other file that best anchors a Task Intent in the Codebase.
_Avoid_: Any matching file, repository root

**Dependency Graph**:
The deterministic directed graph produced from real imports between Codebase files.
_Avoid_: LLM-inferred relationship, folder tree

**Relevant Slice**:
An Entry Point plus the transitive dependencies required to understand and change it safely.
_Avoid_: Arbitrary top-k files, full repository

**Localization**:
The process of mapping Task Intent to an Entry Point and deriving its Relevant Slice.
_Avoid_: Code generation, semantic search alone

**Recent-Change Signal**:
Repository history evidence used to raise files that changed recently within an otherwise valid Relevant Slice.
_Avoid_: Permission to include unrelated files

**Widening Fallback**:
The safety rule that returns more of the Codebase, up to the complete repository, when Localization confidence is insufficient.
_Avoid_: Guessing a narrow slice, silently omitting uncertain files

**Token Baseline**:
The estimated context cost of giving an agent the complete Codebase for the same Task Intent.
_Avoid_: Model billing total, output-token count

**Token Reduction**:
The difference between the Token Baseline and the estimated size of a Relevant Slice. It is a measured comparison, not a claim that task quality improved.
_Avoid_: Accuracy metric, guaranteed cost saving
