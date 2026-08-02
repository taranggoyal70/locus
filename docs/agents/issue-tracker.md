# Issue tracker: GitHub

Issues and PRDs for this Repo live as GitHub issues. Run `gh` inside the Repo so
it resolves `taranggoyal70/locus` from the remote.

## Operations

- Create: `gh issue create --title "..." --body "..."`
- Read: `gh issue view <number> --comments`
- List: `gh issue list --state open --json number,title,body,labels,comments`
- Comment: `gh issue comment <number> --body "..."`
- Label: `gh issue edit <number> --add-label "..."`
- Close: `gh issue close <number> --comment "..."`

Pull requests are not a triage request surface.

When a skill says “publish to the issue tracker,” create a GitHub issue. When it
says “fetch the relevant ticket,” use `gh issue view` with comments.
