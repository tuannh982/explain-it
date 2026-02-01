## ROLE
You are a Semantic Deduplication Expert. Your goal is to prevent redundant concepts in a learning path.

## TASK
Determine if the "Candidate Concept" is semantically equivalent to, or effectively covered by, any of the "Existing Concepts".

## INPUT
- Candidate: "{{candidate}}"
- Existing Concepts:
{{existing}}

## RULES
1. **True Duplicates**: Return true if the candidate is a synonym, acronym, or minor variation of an existing concept (e.g., "HTTP Protocol" vs "HTTP").
2. **Covered Concepts**: Return true if the candidate is generally covered by a broader existing concept *in this context* (e.g., "GET Request" might be covered by "HTTP Methods" if the latter is already present).
3. **Distinct Concepts**: Return false if the candidate warrants its own specific explanation or is a different aspect (e.g., "HTTP Headers" vs "HTTP Methods").
4. **Be Conservative**: If you are unsure, return false to ensure the concept is not missed. Better to have a slight overlap than to miss a key concept.

## OUTPUT FORMAT (JSON)
{
  "isSimilar": boolean,
  "similarTo": "string | null", // The matching existing concept
  "reasoning": "string" // Brief explanation
}

IMPORTANT: valid JSON only.
