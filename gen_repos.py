"""Generate realistic demo repos as {path: content} JSON for Locus.
Every import is real so the dependency graph is meaningful."""
import json, os

def comp(name, imports, body_hint=""):
    lines = [f"import {{ {', '.join(sym for _, sym in imports)} }} from '{path}';" if False else "" for path, imports_ in []]
    # build import statements
    imp_lines = []
    for spec, names in imports:
        if names:
            imp_lines.append(f"import {{ {', '.join(names)} }} from '{spec}';")
        else:
            imp_lines.append(f"import {name0} from '{spec}';".replace("{name0}", spec.split('/')[-1]))
    header = "\n".join(imp_lines)
    filler = "\n".join(
        f"  // {body_hint or name} — line {i}: real component logic would live here"
        for i in range(6)
    )
    return f"""{header}

export default function {name}(props: any) {{
{filler}
  return null; // rendered UI omitted in demo
}}
"""

def mod(imports, exports, hint=""):
    imp_lines = []
    for spec, names in imports:
        imp_lines.append(f"import {{ {', '.join(names)} }} from '{spec}';")
    fns = "\n\n".join(
        f"export function {e}(...args: any[]) {{\n  // {hint or e}\n  return args[0];\n}}"
        for e in exports
    )
    return ("\n".join(imp_lines) + "\n\n" + fns + "\n").lstrip()

# ---- StudentPulse: student-success analytics SaaS ----
# (path, kind, imports)   default-import specs use the file's basename symbol
SP = {
  "app/layout.tsx": ("comp", [("@/components/ui/Nav", ["Nav"])]),
  # DASHBOARD surface
  "app/dashboard/page.tsx": ("comp", [("@/components/KpiRow", ["KpiRow"]),
      ("@/components/EnrollmentChart", ["EnrollmentChart"]),
      ("@/hooks/useDashboard", ["useDashboard"]),
      ("@/components/ui/Button", ["Button"]), ("@/components/ui/Card", ["Card"])]),
  "components/KpiRow.tsx": ("comp", [("@/lib/format", ["formatNumber", "formatPercent"]),
      ("@/components/ui/Card", ["Card"])]),
  "components/EnrollmentChart.tsx": ("comp", [("@/lib/format", ["formatNumber"]),
      ("@/lib/date", ["formatDate", "monthsBetween"])]),
  "hooks/useDashboard.ts": ("mod", [("@/lib/api", ["fetchJson"]), ("@/lib/date", ["formatDate"])], ["useDashboard"]),
  # COHORTS surface
  "app/cohorts/page.tsx": ("comp", [("@/components/CohortTable", ["CohortTable"]),
      ("@/components/RetentionChart", ["RetentionChart"]),
      ("@/hooks/useCohorts", ["useCohorts"]), ("@/components/ui/Card", ["Card"])]),
  "components/CohortTable.tsx": ("comp", [("@/lib/format", ["formatPercent"]),
      ("@/lib/stats", ["median"]), ("@/components/ui/Table", ["Table"])]),
  "components/RetentionChart.tsx": ("comp", [("@/lib/stats", ["retentionCurve"]), ("@/lib/format", ["formatPercent"])]),
  "hooks/useCohorts.ts": ("mod", [("@/lib/api", ["fetchJson"]), ("@/lib/stats", ["retentionCurve"])], ["useCohorts"]),
  # REPORTS surface
  "app/reports/page.tsx": ("comp", [("@/components/ReportBuilder", ["ReportBuilder"]),
      ("@/hooks/useReports", ["useReports"]), ("@/components/ui/Button", ["Button"])]),
  "components/ReportBuilder.tsx": ("comp", [("@/components/ui/Input", ["Input"]),
      ("@/components/ui/Button", ["Button"]), ("@/lib/csv", ["toCsv"])]),
  "hooks/useReports.ts": ("mod", [("@/lib/api", ["fetchJson"]), ("@/lib/csv", ["toCsv"])], ["useReports"]),
  # STUDENTS surface
  "app/students/page.tsx": ("comp", [("@/components/StudentTable", ["StudentTable"]),
      ("@/hooks/useStudents", ["useStudents"]), ("@/components/ui/Input", ["Input"])]),
  "components/StudentTable.tsx": ("comp", [("@/components/ui/Table", ["Table"]), ("@/lib/format", ["formatDate"])]),
  "hooks/useStudents.ts": ("mod", [("@/lib/api", ["fetchJson"])], ["useStudents"]),
  # SETTINGS surface
  "app/settings/page.tsx": ("comp", [("@/hooks/useAuth", ["useAuth"]),
      ("@/components/ui/Button", ["Button"]), ("@/components/ui/Input", ["Input"])]),
  "hooks/useAuth.ts": ("mod", [("@/lib/api", ["fetchJson"])], ["useAuth"]),
  # SHARED ui
  "components/ui/Nav.tsx": ("comp", []),
  "components/ui/Button.tsx": ("comp", []),
  "components/ui/Card.tsx": ("comp", []),
  "components/ui/Table.tsx": ("comp", []),
  "components/ui/Input.tsx": ("comp", []),
  "components/ui/Spinner.tsx": ("comp", []),
  # SHARED lib
  "lib/api.ts": ("mod", [("@/lib/db", ["getConnection"])], ["fetchJson", "postJson"]),
  "lib/db.ts": ("mod", [], ["getConnection", "query"]),
  "lib/format.ts": ("mod", [], ["formatNumber", "formatPercent", "formatDate"]),
  "lib/date.ts": ("mod", [("@/lib/format", ["formatDate"])], ["monthsBetween", "formatDate", "startOfMonth"]),
  "lib/stats.ts": ("mod", [("@/lib/format", ["formatPercent"])], ["median", "retentionCurve", "summary"]),
  "lib/csv.ts": ("mod", [("@/lib/format", ["formatDate"])], ["toCsv", "parseCsv"]),
}

def render(spec_map):
    files = {}
    for path, (kind, imports, *rest) in spec_map.items():
        name = os.path.basename(path).rsplit(".", 1)[0].replace("-", "")
        if kind == "comp":
            files[path] = comp(name[:1].upper() + name[1:], imports, hint(path))
        else:
            files[path] = mod(imports, rest[0], hint(path))
    return files

def hint(path):
    if "dashboard" in path: return "dashboard KPIs and enrollment trend"
    if "cohort" in path: return "cohort retention analytics"
    if "report" in path: return "report generation"
    if "student" in path: return "student roster"
    if "format" in path: return "number/percent/date formatting"
    if "date" in path: return "date helpers"
    return ""

repo = {
  "name": "StudentPulse",
  "slug": "studentpulse",
  "description": "A student-success analytics SaaS — dashboard, cohort analytics, reports, roster, settings.",
  "root": "src",
  "recentlyChanged": ["src/lib/date.ts", "src/components/EnrollmentChart.tsx"],
  "files": {f"src/{p}": c for p, c in render(SP).items()},
}

out_dir = os.path.join(os.path.dirname(__file__), "test", "fixtures")
os.makedirs(out_dir, exist_ok=True)
with open(os.path.join(out_dir, "studentpulse.json"), "w") as f:
    json.dump(repo, f, indent=1)
print(f"wrote studentpulse.json with {len(repo['files'])} files")
