# Evaluation Fixtures

This directory contains synthetic fixtures for validating XtalLoop's data contract before any real meeting data is introduced.

## Files

- `golden-set.jsonl`: 24 synthetic Chinese meeting snippets with 27 expected scientific claims.
- `extraction-bundle.example.json`: one complete meeting-to-domain-object example.

The fixtures cover parameter changes, ranges, units, negation, unresolved decisions, team controversy, risks, ambiguous assignees, relative deadlines, historical failures and cross-experiment reuse.

Every claim includes a SourceAnchor with the synthetic speaker, time range, original quote and SHA-256 quote hash. The current annotations are `single_reviewed`; a second independent team reviewer is required before the set is used to report model quality.

Regenerate and validate:

```powershell
npm test
```

Do not replace these fixtures with real meeting content unless it has been explicitly authorized and deidentified.

