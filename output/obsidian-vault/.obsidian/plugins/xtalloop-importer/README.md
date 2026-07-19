# XtalLoop Importer

Minimal Obsidian plugin for the XtalLoop prototype.

It imports an XtalLoop extraction bundle from:

```text
XtalLoop/import/extraction-bundle.json
```

and writes evidence-linked Markdown cards into:

```text
XtalLoop/
```

Generated cards include:

- `Index.md`
- `Meetings/<meeting_id>.md`
- `Experiments/<experiment_id>.md`
- `Claims/<claim_id>.md`
- `Ontology/<ontology_version>.md`
- `Graph/Relationships.md`

The plugin does not connect to Feishu, does not request credentials, and does not publish anything back to the organization source of truth. It is only a local review and reuse surface for authorized or deidentified extraction bundles.
