# Evaluation Fixtures

This directory contains synthetic fixtures for validating XtalLoop's data contract before any real meeting data is introduced.

## Files

- `golden-set.jsonl`: 24 synthetic Chinese meeting snippets with 27 expected scientific claims.
- `extraction-bundle.example.json`: one complete meeting-to-domain-object example.
- `demo-meeting-transcript.json`: a synthetic multi-utterance meeting transcript for the P0-04 extractor smoke test.
- `demo-meeting-transcript.normalized-from-minutes.json`: extractor-ready transcript generated from the redacted Feishu Minutes sample.
- `demo-extraction-bundle.generated.json`: deterministic extractor output generated from the demo transcript.
- `demo-writeback-plan.generated.json`: deterministic P0-05 dry-run writeback plan for Base / Task / Docx.
- `demo-writeback-execution-log.generated.json`: deterministic simulated dry-run execution log for the writeback plan.
- `demo-e2e-report.md`: human-readable demo evidence report generated from the normalized transcript, extraction bundle and writeback plan.

The fixtures cover parameter changes, ranges, units, negation, unresolved decisions, team controversy, risks, ambiguous assignees, relative deadlines, historical failures and cross-experiment reuse.

Every claim includes a SourceAnchor with the synthetic speaker, time range, original quote and SHA-256 quote hash. The current annotations are `single_reviewed`; a second independent team reviewer is required before the set is used to report model quality.

Regenerate and validate:

```powershell
npm test
```

Run the end-to-end demo only:

```powershell
npm run demo:e2e
```

Run only the extractor:

```powershell
npm run extract:demo
```

Normalize only the Feishu Minutes sample:

```powershell
npm run normalize:minutes
```

Run only the writeback planner:

```powershell
npm run plan:writeback
```

Do not replace these fixtures with real meeting content unless it has been explicitly authorized and deidentified.
