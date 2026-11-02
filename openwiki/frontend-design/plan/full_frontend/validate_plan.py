"""Read-only structural checks for paired frontend plans and wireframes.

Run from repository root with: python -B openwiki/frontend-design/plan/full_frontend/validate_plan.py
"""

import re
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[4]
FRONTEND = ROOT / "openwiki/frontend-design"
sys.path.insert(0, str(FRONTEND))

from build_frontend_design import MODULES, operation_catalog, owned_ops, related_ops  # noqa: E402


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()
        self.links: list[str] = []
        self.labels: set[str] = set()
        self.controls: set[str] = set()
        self.main = False
        self.headings = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        ident = values.get("id")
        if ident:
            if ident in self.ids:
                raise ValueError(f"Duplicate HTML ID {ident}")
            self.ids.add(ident)
        if tag in {"a", "link", "script"}:
            href = values.get("href") if tag != "script" else values.get("src")
            if href:
                self.links.append(href)
        if tag == "label" and values.get("for"):
            self.labels.add(values["for"])
        if tag in {"input", "select", "textarea"} and ident:
            self.controls.add(ident)
        if tag == "main":
            self.main = True
        if tag == "h1":
            self.headings = True


def require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)


def check_links(path: Path, data: str, html: bool = False) -> int:
    if html:
        parser = PageParser()
        parser.feed(data)
        require(parser.main and parser.headings, f"Missing main/h1: {path}")
        require(parser.controls <= parser.labels, f"Unlabelled input: {path}")
        targets = parser.links
    else:
        targets = re.findall(r"(?<!!)\[[^\]\n]+\]\(([^)\n]+)\)", data)
    count = 0
    for target in targets:
        uri = urlsplit(target)
        if uri.scheme or uri.netloc or not uri.path and not uri.fragment:
            continue
        resolved = (path.parent / unquote(uri.path)).resolve() if uri.path else path
        require(resolved.is_relative_to(ROOT), f"Link escapes repository: {path}: {target}")
        require(resolved.exists(), f"Broken link: {path.relative_to(ROOT)}: {target}")
        if uri.fragment and resolved.suffix == ".html":
            target_data = resolved.read_text(encoding="utf-8")
            require(re.search(r'\bid="' + re.escape(unquote(uri.fragment)) + r'"', target_data) is not None, f"Missing HTML anchor: {path}: {target}")
        count += 1
    return count


def main() -> None:
    source_ops, backend_ops = operation_catalog()
    modules = {m.name: m for m in MODULES}
    require(len(MODULES) == 32 and len(modules) == 32, "F01–F32 inventory changed")
    roadmap = (FRONTEND / "GENERAL_PLAN.md").read_text(encoding="utf-8")
    for module in MODULES:
        require(re.search(rf"^\| F{module.number:02} \| `{module.name}`", roadmap, re.M) is not None, f"Roadmap mismatch: {module.name}")
    require(len(source_ops) == len(backend_ops) == 154, "Source count changed")

    program = FRONTEND / "plan/full_frontend"
    expected_program = {"PLAN", "REQUIREMENTS", "DESIGN", "OPERATIONS", "MODULES", "DECISIONS", "EXECUTION", "WIREFRAMES", "TESTS", "CHECKLIST", "VERIFICATION"}
    program_docs = {p.stem for p in program.glob("*.md")}
    require(program_docs == expected_program, f"Program docs mismatch: {program_docs ^ expected_program}")
    ops_index = (program / "OPERATIONS.md").read_text(encoding="utf-8")
    indexed = re.findall(r"^\| `(\w+)` \| (GET|POST|PUT|PATCH|DELETE) `(/[^`]+)` \|", ops_index, re.M)
    counts = Counter(opid for opid, _, _ in indexed)
    require(set(counts) == set(source_ops) and all(count == 1 for count in counts.values()), "Operation disposition is missing or duplicated")
    require(all(source_ops[opid][:2] == (method, path) for opid, method, path in indexed), "Operation method/path changed")
    require("Backend-only provider callback" in ops_index, "Webhook must not become browser action")

    seen: set[str] = set()
    html_count = 0
    markdown_count = 0
    linked_count = 0
    for module in MODULES:
        mid = f"F{module.number:02}"
        plan = FRONTEND / "plan" / module.name
        wr = FRONTEND / "wr" / module.name
        children = {p.stem for p in plan.glob("*.md")}
        expected_child = {"PLAN", "REQUIREMENTS", "DESIGN", "TESTS", "CHECKLIST", "VERIFICATION"}
        require(children == expected_child, f"Child docs mismatch: {module.name}: {children ^ expected_child}")
        pages = {p.stem for p in wr.glob("*.html")}
        expected_pages = {s.slug for s in module.screens}
        require(pages == expected_pages and "index" in pages, f"Wireframe mismatch: {module.name}: {pages ^ expected_pages}")
        for part in expected_child:
            data = (plan / f"{part}.md").read_text(encoding="utf-8")
            require(mid in data, f"Missing child scope: {module.name}/{part}")
            require(not any(line != line.rstrip() for line in data.splitlines()), f"Trailing whitespace: {module.name}/{part}")
            if part == "CHECKLIST":
                require(not re.search(r"^- \[x\] .*?(?:FN\d+|OP\d+|runtime|browser).*?(?:pass|complete)", data, re.M | re.I), f"Unchecked implementation evidence required: {module.name}")
            linked_count += check_links(plan / f"{part}.md", data)
            markdown_count += 1
        req = (plan / "REQUIREMENTS.md").read_text(encoding="utf-8")
        tests = (plan / "TESTS.md").read_text(encoding="utf-8")
        for opid in related_ops(module, backend_ops):
            require(f"`{opid}`" in req and f"`{opid}`" in tests, f"Missing operation tests/requirements: {module.name}: {opid}")
        seen.update(owned_ops(module, backend_ops))
        for screen in module.screens:
            page = wr / f"{screen.slug}.html"
            data = page.read_text(encoding="utf-8")
            require(f"{mid}-SCR" in data and "không kết nối API" in data, f"Missing page identity/prototype notice: {page}")
            require('class="panel scenarios"' in data and 'id="state-01"' in data, f"Missing state variants: {page}")
            require("<h2>Ánh xạ API" in data, f"Missing source API context: {page}")
            linked_count += check_links(page, data, html=True)
            html_count += 1
    require(seen == set(source_ops) - {"receiveVerifiedPaymentWebhook"}, "Not every employee operation has exactly one owner")
    for file in (FRONTEND / "wr/index.html", FRONTEND / "wr/flows.html"):
        linked_count += check_links(file, file.read_text(encoding="utf-8"), html=True)
        html_count += 1
    for file in list(program.glob("*.md")) + [FRONTEND / "wr/README.md"]:
        linked_count += check_links(file, file.read_text(encoding="utf-8"))
        markdown_count += 1
    require((FRONTEND / "wr/assets/wireframes.css").is_file() and (FRONTEND / "wr/assets/wireframes.js").is_file(), "Missing portable wireframe assets")
    print(f"PASS: {len(MODULES)} module pairs, {markdown_count} Markdown files, {html_count} HTML pages and {linked_count} local links")
    print(f"PASS: 154 unique source operations; 153 employee operations owned, one backend-only webhook; source method/path match")
    print("Static plan/HTML consistency only. No application behavior, browser, PostgreSQL or provider evidence.")


if __name__ == "__main__":
    main()
