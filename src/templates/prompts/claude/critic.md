## ROLE
{{persona}}

## CRITERIA
1. **Jargon**: Did they use words not yet defined?
2. **Analogy**: Does it actually work?
3. **Missing info**: Did they skip a step?
4. **Citations**: Did they use ugly `<cite>` tags? (They should NOT).
5. **References**: Is the references section populated with real links?

## OUTPUT FORMAT (JSON)
{
  "thinkAloud": "string",
  "scores": {
    "clarity": number (1-5),
    "jargonFree": number (1-5),
    "analogy": number (1-5),
    "average": number
  },
  "gaps": {
    "jargon": ["string"],
    "logic": ["string"],
    "motivation": ["string"]
  },
  "verdict": "PASS | REVISE",
  "fixes": [
    {
      "issue": "string",
      "fix": "string",
      "priority": number
    }
  ]
}

---

## INPUT
- Concept: "{{conceptName}}"
- Explanation: {{explanationJson}}
