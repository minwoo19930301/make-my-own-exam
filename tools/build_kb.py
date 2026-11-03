"""Build data/kb.json from the official ETS GRE "Analyze an Issue" topic pool.

Usage: uv run --with pypdf python tools/build_kb.py [path/to/issue-pool.pdf]
Without a path, the PDF is downloaded from ets.org into .cache/.
"""
import collections
import json
import re
import sys
import urllib.request
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
POOL_URL = "https://www.ets.org/pdfs/gre/issue-pool.pdf"

# The six task variants ETS uses. Order matters: the first match wins.
VARIANTS = [
    ("claim-reason", "the claim and the reason", "Agree/disagree with a claim AND the reason behind it"),
    ("claim-challenge", "with the claim. In developing", "Agree/disagree with a claim, addressing the strongest challenges"),
    ("recommendation", "with the recommendation", "Agree/disagree with a recommendation, citing when it would or would not help"),
    ("statement", "with the statement", "Agree/disagree with a statement, considering when it might or might not hold"),
    ("two-views", "which view more closely aligns", "Choose between two views and address both"),
    ("policy", "your views on the policy", "Discuss a policy and its consequences"),
]

THEMES = {
    "education": r"educat|student|school|college|universit|teach|curricul|course|learning|grades|field of study|major",
    "government": r"government|politic|nation|law|leader|official|public|policy|authority|in power",
    "science-tech": r"scien|research|technolog|machine|discover|internet|computer|smartphone|device|online|data",
    "arts-culture": r"\bart|arts\b|artist|poetry|novel|film|culture|cultural|creative|media|journalism|imag(e|ination)|buildings",
    "society-ethics": r"society|societ|hero|moral|ethic|privacy|individual|people's|human|self-interest|scandal|success",
    "knowledge": r"knowledge|discussion|points of view|fact|idea|inquiry|expert|argument|views|judgment|history|past|imagination",
    "environment": r"species|wilderness|environment|trash|waste|natural state",
    "personal-life": r"goal|risk|beliefs|decision|options|challenging situation|traveling|pace of life|social groups|define ourselves|fame|limitations|boredom",
    "economy-work": r"job|career|lucrative|corporat|business|money|econom|salar|employ",
}

# Recurring ideas the pool returns to with different wording or task variants.
CONCEPTS = [
    ("nation-greatness", "What makes a nation great", r"great nation|nation is great|nation's greatness|well-being of that country|well- being of that country|effectiveness of a country's leaders"),
    ("breadth-requirements", "Required courses outside the major", r"outside the student|outside their major|variety of courses|poetry, novels|elective courses|required courses"),
    ("field-of-study-choice", "How students should choose a field of study", r"field of study|fields of study|lucrative careers|availability of jobs|courses that seem most likely to lead to jobs"),
    ("study-abroad", "Studying or living abroad", r"foreign country|numerous places"),
    ("national-curriculum", "One national curriculum", r"national curriculum"),
    ("student-input", "Student interests shaping the curriculum", r"interests and suggestions|what students want|students' interests"),
    ("teaching-methods", "How to teach and assess", r"best way to teach|teachers' salaries|facts only after|assessment of students|group assignments|effective teacher|special talents|question what they are taught|competition for high grades|volunteer time"),
    ("education-purpose", "The purpose of formal education", r"free the mind|formal education|personal discipline|free of charge|free university"),
    ("leadership-ethics", "What makes an effective leader", r"leader|public official|step down after five years|own judgment|withhold information|common ground|ideal|yield to public opinion"),
    ("research-funding", "Funding and directing research", r"scientific research|researchers should|benefit the greatest number|immediate, practical"),
    ("arts-funding", "Government and the arts", r"funding for the arts|funding of the arts|work of art"),
    ("environment-preservation", "Saving species and wilderness", r"endangered|species|wilderness|trash"),
    ("heroes-and-media", "Heroes, media and image", r"hero|appealing image|scandal|journalism"),
    ("learning-from-others", "Learning from agreement vs disagreement", r"views we share|contrasting points of view|opposing viewpoint|critical of it|critical judgment"),
    ("imagination-expertise", "Imagination, expertise and originality", r"imagination|beginner|expert|accidental|commonplace things|past achievements|outside that field|creative fields"),
    ("history-past", "The value of knowing the past", r"history|the past|old buildings|after them, not by their contemporaries"),
    ("technology-life", "Technology and modern life", r"technolog|machines|portable devices|online|rapid pace|luxuries|internet"),
    ("cities-society", "Cities and the character of a society", r"cities|youth|character of a society|social groups"),
    ("self-and-behavior", "What shapes people's behavior and success", r"behavior|fame and recognition|attitudes|success|limitations|boredom|self-interest|compromise one's own|risky action|means taken|options|challenging situation"),
    ("law-and-authority", "Laws, authority and dissent", r"laws|corporations|question authority|policy decisions|skeptical of new leaders|immediate problems"),
    ("knowledge-truth", "Knowledge, facts and truth", r"knowledge|fact|privacy|persuade|scientific discoveries"),
]


def load_text(pdf: Path) -> str:
    return "\n".join((p.extract_text() or "") for p in PdfReader(str(pdf)).pages)


def parse(text: str):
    text = text.replace(POOL_URL, " ")
    text = re.sub(r"\n\s*\d+\s*\n", "\n", text)
    body = re.sub(r"\s+", " ", text.split("actual test.", 1)[1]).strip()
    body = body.split("Copyright ©", 1)[0]
    pat = re.compile(r"Write a response in which you[^.]*\.(?:\s*In developing and supporting your position,[^.]*\.)?")
    items, pos = [], 0
    for m in pat.finditer(body):
        items.append((body[pos:m.start()].strip(), m.group(0).strip()))
        pos = m.end()
    return items


def variant_of(instructions: str) -> str:
    for key, needle, _ in VARIANTS:
        if needle in instructions:
            return key
    raise ValueError(f"unknown task variant: {instructions[:80]}")


def tags(statement: str):
    s = statement.lower()
    themes = [k for k, rx in THEMES.items() if re.search(rx, s)]
    concept = next((k for k, _, rx in CONCEPTS if re.search(rx, s)), "other")
    return themes or ["other"], concept


def norm(s: str) -> str:
    return re.sub(r"[^a-z ]", "", s.lower().replace("well- being", "well-being"))


def build(pdf: Path):
    items = parse(load_text(pdf))
    first_seen = {}
    topics = []
    for i, (statement, instructions) in enumerate(items):
        key = norm(statement)
        first_seen.setdefault(key, i)
        themes, concept = tags(statement)
        topics.append({
            "id": f"issue-{i + 1:03d}",
            "n": i + 1,
            "statement": statement,
            "instructions": instructions,
            "variant": variant_of(instructions),
            "themes": themes,
            "concept": concept,
            "repeatOf": None if first_seen[key] == i else f"issue-{first_seen[key] + 1:03d}",
        })
    return topics


def stats(topics):
    n = len(topics)
    variants = collections.Counter(t["variant"] for t in topics)
    themes = collections.Counter(th for t in topics for th in t["themes"])
    concepts = collections.Counter(t["concept"] for t in topics)
    ranked = concepts.most_common()
    covered, cumulative = 0, []
    for key, count in ranked:
        covered += count
        cumulative.append({"concept": key, "count": count, "cumulativeShare": round(covered / n, 3)})
    return {
        "total": n,
        "uniqueStatements": len({norm(t["statement"]) for t in topics}),
        "variants": {k: variants[k] for k, _, _ in VARIANTS},
        "themes": dict(themes.most_common()),
        "concepts": cumulative,
    }


def main():
    pdf = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / ".cache" / "issue-pool.pdf"
    if not pdf.exists():
        pdf.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(POOL_URL, headers={"User-Agent": "Mozilla/5.0"})
        pdf.write_bytes(urllib.request.urlopen(req, timeout=60).read())
    topics = build(pdf)
    kb = {
        "source": {
            "title": '"Analyze an Issue" Topic Pool for the GRE General Test',
            "publisher": "ETS",
            "url": POOL_URL,
            "note": "Topic text is quoted from the pool ETS publishes for test preparation. GRE and ETS are registered trademarks of ETS. This project is not affiliated with or endorsed by ETS.",
        },
        "variants": [{"key": k, "label": label} for k, _, label in VARIANTS],
        "concepts": [{"key": k, "label": label} for k, label, _ in CONCEPTS] + [{"key": "other", "label": "Other"}],
        "stats": stats(topics),
        "topics": topics,
    }
    out = ROOT / "public" / "data" / "kb.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(kb, indent=1, ensure_ascii=False) + "\n")
    s = kb["stats"]
    print(f"{s['total']} topics, {s['uniqueStatements']} unique statements -> {out.relative_to(ROOT)}")
    print("variants", s["variants"])
    print("concepts", [(c["concept"], c["count"]) for c in s["concepts"]])


if __name__ == "__main__":
    main()
