"""One-off: seed content/queue.json from the research keyword map. Kept for reference and re-seeding.

Usage: python3 scripts/seed-queue.py /mnt/project-files/research/keyword-topic-map.md
"""
import json, os, re, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PILLAR_TO_CLUSTER = {1: "wills", 2: "trusts", 3: "probate", 4: "power-of-attorney", 5: "healthcare-directives",
    6: "guardianship", 7: "special-needs", 8: "estate-tax", 9: "blended-families", 10: "business-owners",
    11: "digital-assets", 12: "elder-care", 13: "after-a-death", 14: "probate", 15: "life-stages"}
PRIORITY = {"probate": 1, "after-a-death": 1, "trusts": 1, "guardianship": 2, "life-stages": 2, "elder-care": 2,
    "estate-tax": 3, "digital-assets": 3}
STOP = set("a an the of to for in on and or is are do does i my you your what how can should when who it be with vs versus".split())

def slugify(s):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")[:70].rstrip("-")

def tokens(s):
    return {t for t in re.findall(r"[a-z0-9]+", s.lower()) if t not in STOP}

def existing_pages():
    pages = []
    tm = json.load(open(os.path.join(ROOT, "content/topic-map.json")))
    for c in tm["clusters"]:
        pages.append((c["pillar"], f"/learn/{c['slug']}"))
        pages += [(t, f"/learn/{c['slug']}/{s}") for s, t in c["articles"]]
    for d in ["guides", "blog", "compare", "life-events"]:
        for f in glob.glob(os.path.join(ROOT, "content", d, "*.md")):
            m = re.search(r'^title:\s*"?(.*?)"?\s*$', open(f).read(), re.M)
            if m:
                pages.append((m.group(1), f"/{d}/{os.path.basename(f)[:-3]}"))
    return [(tokens(t), u) for t, u in pages]

def covered_by(text, pages):
    tk = tokens(text)
    best, url = 0.0, None
    for ptk, u in pages:
        if not tk or not ptk:
            continue
        score = len(tk & ptk) / len(tk)
        if score > best:
            best, url = score, u
    return url if best >= 0.75 else None

def intent_for(kw, is_question):
    k = kw.lower()
    if re.search(r"\bby state\b|\[state\]", k): return "state-topic"
    if "near me" in k or re.search(r"\b(lawyer|attorney)\b$", k): return "local"
    if re.search(r"\bvs\.?\b|\bversus\b", k): return "comparison"
    if re.search(r"\bcost|how much|fee", k): return "cost"
    return "question" if is_question else "explainer"

def main(path):
    text = open(path).read()
    pages = existing_pages()
    items, seen = [], set()
    for m in re.finditer(r"^## Pillar (\d+): .*?(?=^## )", text, re.S | re.M):
        n = int(m.group(1)); block = m.group(0); cluster = PILLAR_TO_CLUSTER[n]
        kws = re.search(r"\*\*Cluster keywords[^*]*\*\*:?\s*(.*)", block)
        paa = re.search(r"\*\*PAA-style questions[^*]*\*\*:?\s*(.*)", block)
        cands = []
        if kws: cands += [(k.strip(" .").strip(), False) for k in kws.group(1).split(";")]
        if paa: cands += [(q.strip() + "?", True) for q in paa.group(1).split("?") if q.strip()]
        for kw, q in cands:
            if not kw or len(kw) < 4: continue
            slug = slugify(kw)
            if slug in seen: continue
            seen.add(slug)
            intent = intent_for(kw, q)
            cov = covered_by(kw, pages)
            status = "covered" if cov else ("blocked" if intent in ("state-topic", "local") else "queued")
            item = {"id": f"K{len(items)+1:03d}", "keyword": kw, "intent": intent, "cluster": cluster,
                    "slug": slug, "priority": PRIORITY.get(cluster, 4) + (0 if q else 1), "status": status,
                    "source": f"keyword-topic-map.md pillar {n}"}
            if cov: item["coveredBy"] = cov
            if status == "blocked": item["blockedBy"] = "launch state and attorney-verified state data"
            items.append(item)
    out = {"_note": "Daily landing page queue. See docs/content-pipeline.md. Statuses: queued -> drafted (PR open) -> published (merged, attorney approved). covered = an existing page already answers it (improve that page instead). blocked = waiting on something only the firm can supply.",
           "items": items}
    json.dump(out, open(os.path.join(ROOT, "content/queue.json"), "w"), indent=1)
    from collections import Counter
    print(Counter(i["status"] for i in items), Counter(i["intent"] for i in items if i["status"] == "queued"))

if __name__ == "__main__":
    main(sys.argv[1])
