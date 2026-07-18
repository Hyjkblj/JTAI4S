import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readJsonDirectory(path) {
  const files = (await readdir(path))
    .filter((name) => name.endsWith(".json"))
    .sort();
  return Promise.all(
    files.map(async (name) => ({
      name,
      value: await readJson(resolve(path, name))
    }))
  );
}

const claimSchema = await readJson(
  resolve(root, "schemas", "scientific-claim.schema.json")
);
const goldenEntrySchema = await readJson(
  resolve(root, "schemas", "golden-set-entry.schema.json")
);
const extractionBundleSchema = await readJson(
  resolve(root, "schemas", "extraction-bundle.schema.json")
);

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  allowUnionTypes: true
});
addFormats(ajv);
ajv.addSchema(claimSchema);

const validateClaim = ajv.getSchema(claimSchema.$id);
const validateGoldenEntry = ajv.compile(goldenEntrySchema);
const validateExtractionBundle = ajv.compile(extractionBundleSchema);

const goldenSetText = await readFile(
  resolve(root, "evaluation", "golden-set.jsonl"),
  "utf8"
);
const goldenEntries = goldenSetText
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`golden-set.jsonl line ${index + 1}: ${error.message}`);
    }
  });

const errors = [];
const claimIds = new Set();
const idempotencyKeys = new Set();

for (const entry of goldenEntries) {
  if (!validateGoldenEntry(entry)) {
    errors.push(
      `${entry.sample_id ?? "unknown"}: schema validation failed: ${ajv.errorsText(
        validateGoldenEntry.errors,
        { separator: "; " }
      )}`
    );
    continue;
  }

  if (entry.utterance.end_ms <= entry.utterance.start_ms) {
    errors.push(`${entry.sample_id}: utterance end_ms must be after start_ms`);
  }

  for (const claim of entry.expected_claims) {
    const source = claim.source;
    const expectedHash = `sha256:${createHash("sha256")
      .update(source.quote)
      .digest("hex")}`;

    if (source.end_ms <= source.start_ms) {
      errors.push(`${claim.claim_id}: source end_ms must be after start_ms`);
    }
    if (source.meeting_id !== entry.meeting.meeting_id) {
      errors.push(`${claim.claim_id}: source meeting_id does not match entry`);
    }
    if (source.utterance_id !== entry.utterance.utterance_id) {
      errors.push(`${claim.claim_id}: source utterance_id does not match entry`);
    }
    if (source.speaker_id !== entry.utterance.speaker_id) {
      errors.push(`${claim.claim_id}: source speaker_id does not match entry`);
    }
    if (source.quote !== entry.utterance.text) {
      errors.push(`${claim.claim_id}: source quote does not match utterance text`);
    }
    if (source.quote_hash !== expectedHash) {
      errors.push(`${claim.claim_id}: source quote_hash is incorrect`);
    }
    if (claim.meeting_id !== entry.meeting.meeting_id) {
      errors.push(`${claim.claim_id}: claim meeting_id does not match entry`);
    }
    if (claim.experiment_id !== entry.meeting.experiment_id) {
      errors.push(`${claim.claim_id}: claim experiment_id does not match entry`);
    }
    if (claim.data_origin !== entry.data_origin) {
      errors.push(`${claim.claim_id}: claim data_origin does not match entry`);
    }
    if (claimIds.has(claim.claim_id)) {
      errors.push(`${claim.claim_id}: duplicate claim_id`);
    }
    if (idempotencyKeys.has(claim.idempotency_key)) {
      errors.push(`${claim.claim_id}: duplicate idempotency_key`);
    }

    claimIds.add(claim.claim_id);
    idempotencyKeys.add(claim.idempotency_key);
  }
}

const validExamples = await readJsonDirectory(
  resolve(root, "schemas", "examples", "valid")
);
for (const example of validExamples) {
  if (!validateClaim(example.value)) {
    errors.push(
      `${example.name}: expected valid but failed: ${ajv.errorsText(
        validateClaim.errors,
        { separator: "; " }
      )}`
    );
  }
}

const invalidExamples = await readJsonDirectory(
  resolve(root, "schemas", "examples", "invalid")
);
for (const example of invalidExamples) {
  if (validateClaim(example.value)) {
    errors.push(`${example.name}: expected invalid but passed`);
  }
}

const extractionBundle = await readJson(
  resolve(root, "evaluation", "extraction-bundle.example.json")
);
if (!validateExtractionBundle(extractionBundle)) {
  errors.push(
    `extraction-bundle.example.json: schema validation failed: ${ajv.errorsText(
      validateExtractionBundle.errors,
      { separator: "; " }
    )}`
  );
}

if (errors.length > 0) {
  console.error(`Artifact validation failed with ${errors.length} error(s):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  [
    "Artifact validation passed.",
    `Golden-set entries: ${goldenEntries.length}`,
    `Scientific claims: ${claimIds.size}`,
    `Valid schema examples: ${validExamples.length}`,
    `Rejected invalid examples: ${invalidExamples.length}`,
    "Extraction bundles: 1"
  ].join("\n")
);
