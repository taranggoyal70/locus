# LinkedIn launch post — Locus public early access

I didn’t build Locus because I wanted another AI project.

I built it because I was tired of managing context.

I’d start a coding task with an agent, explain the bug, share the important files, and make real progress. Then the conversation would grow, unrelated code would creep in, and the context window would fill up.

Eventually, I was spending more time reminding the agent what mattered than solving the problem.

That was the first reason I built Locus: give a coding agent a task-sized view of a repository, and show the developer why each file was selected.

But while testing it, I noticed something else.

The complete task is rarely inside the prompt.

Sometimes it is in a screenshot. Sometimes it is buried in a bug report, PDF, or product document.

One of my own issues started with this message:

“Account created but profile save failed.”

The sentence was useful, but the surrounding evidence explained what the code actually needed to do.

So I added task evidence to Locus.

You can now attach a screenshot, PDF, DOCX, Markdown, or text file. Locus extracts the useful details, keeps them visible for inspection, and uses that evidence when mapping the task to the codebase.

Uploaded binaries are processed in memory and are not intentionally retained. Screenshot OCR runs inside the browser. If you submit a task, extracted text can become part of its durable Run record under the published retention policy.

I also replayed a real historical fix from one of my projects. For that task, Locus selected 8 of 57 files, left 49 unrelated files out, and included the file changed next in the real fix—using an estimated 89% fewer tokens.

That is a historical replay, not a claim that an agent autonomously solved the task. I would rather be precise about what worked than hide the limitation behind a polished demo.

Locus is now in public early access. Anyone can create an account and try public-Repo localization; I’m also looking for 10 developers who regularly use Codex, Claude Code, Cursor, or another coding agent to test complete Agent Runs.

Try it on one real task. Attach the messy bug report. Then tell me where it breaks.

Live: https://locus-five-iota.vercel.app

GitHub: https://github.com/taranggoyal70/locus

#BuildInPublic #OpenSource #DeveloperTools #CodingAgents
