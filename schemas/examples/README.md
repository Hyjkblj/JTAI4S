# Scientific Claim Schema Examples

`valid/` contains five claims that must pass `scientific-claim.schema.json`.

`invalid/` contains five claims that must be rejected:

1. Missing SourceAnchor.
2. `VERIFIED` without an approving reviewer.
3. Confidence greater than 1.
4. Invalid Claim ID format.
5. Parameter change without `previous_value`.

`npm test` verifies both the positive and negative cases. Invalid examples passing validation is treated as a test failure.
