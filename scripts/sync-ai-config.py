import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLAUDE_DIR = ROOT / ".claude"
AGENTS_DIR = ROOT / ".agents"
CODEX_DIR = ROOT / ".codex"

def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")

def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")

def parse_frontmatter(raw: str) -> tuple[dict, str]:
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", raw, re.DOTALL)
    if not match:
        return {}, raw.strip()
    fm_block, body = match.group(1), match.group(2).strip()
    meta = {}
    for line in fm_block.splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip().strip('"').strip("'")
    return meta, body

def sync_all() -> None:
    claude_md = ROOT / "CLAUDE.md"
    if claude_md.exists():
        banner = "<!-- AUTO-GENERATED FROM CLAUDE.md. DO NOT EDIT DIRECTLY. -->\n\n"
        write_text(ROOT / "AGENTS.md", banner + read_text(claude_md))

    dst_skills = AGENTS_DIR / "skills"
    if dst_skills.exists():
        shutil.rmtree(dst_skills)
    if (CLAUDE_DIR / "skills").exists():
        shutil.copytree(CLAUDE_DIR / "skills", dst_skills)

    src_cmds = CLAUDE_DIR / "commands"
    if src_cmds.exists():
        for md_file in src_cmds.rglob("*.md"):
            skill_name = "-".join(md_file.relative_to(src_cmds).with_suffix("").parts)
            meta, body = parse_frontmatter(read_text(md_file))
            desc = meta.get("description", f"Workflow command {skill_name}")
            content = f"---\nname: {skill_name}\ndescription: {desc}\n---\n\n{body}\n"
            write_text(AGENTS_DIR / "skills" / skill_name / "SKILL.md", content)

    dst_rules = AGENTS_DIR / "rules"
    if dst_rules.exists():
        shutil.rmtree(dst_rules)
    src_rules = CLAUDE_DIR / "rules"
    if src_rules.exists():
        for md_file in src_rules.rglob("*.md"):
            rule_name = "-".join(md_file.relative_to(src_rules).with_suffix("").parts) + ".md"
            meta, body = parse_frontmatter(read_text(md_file))
            trigger = meta.get("trigger", "always_on")
            write_text(dst_rules / rule_name, f"---\ntrigger: {trigger}\n---\n\n{body}\n")

    dst_agents = CODEX_DIR / "agents"
    if dst_agents.exists():
        shutil.rmtree(dst_agents)
    src_agents = CLAUDE_DIR / "agents"
    if src_agents.exists():
        for md_file in src_agents.rglob("*.md"):
            meta, body = parse_frontmatter(read_text(md_file))
            desc = meta.get("description", f"Sub-agent {md_file.stem}")
            escaped = body.replace('"""', '\\"\\"\\"')
            toml = f'description = "{desc}"\n\ndeveloper_instructions = """\n{escaped}\n"""\n'
            write_text(dst_agents / f"{md_file.stem}.toml", toml)

    print("=== DONG BO THANH CONG TAI D:\\Projects\\keycraft-3d ===")

if __name__ == "__main__":
    sync_all()