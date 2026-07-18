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
const meetingTranscriptSchema = await readJson(
  resolve(root, "schemas", "meeting-transcript.schema.json")
);
const writebackPlanSchema = await readJson(
  resolve(root, "schemas", "feishu-writeback-plan.schema.json")
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
const validateMeetingTranscript = ajv.compile(meetingTranscriptSchema);
const validateWritebackPlan = ajv.compile(writebackPlanSchema);

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
const demoTranscript = await readJson(
  resolve(root, "evaluation", "demo-meeting-transcript.json")
);
const normalizedMinutesTranscript = await readJson(
  resolve(root, "evaluation", "demo-meeting-transcript.normalized-from-minutes.json")
);
const generatedExtractionBundle = await readJson(
  resolve(root, "evaluation", "demo-extraction-bundle.generated.json")
);
const writebackPlan = await readJson(
  resolve(root, "evaluation", "demo-writeback-plan.generated.json")
);
const extractionBundles = [
  {
    name: "extraction-bundle.example.json",
    value: extractionBundle,
    generatedByExtractor: false
  },
  {
    name: "demo-extraction-bundle.generated.json",
    value: generatedExtractionBundle,
    generatedByExtractor: true
  }
];
const meetingTranscripts = [
  {
    name: "demo-meeting-transcript.json",
    value: demoTranscript
  },
  {
    name: "demo-meeting-transcript.normalized-from-minutes.json",
    value: normalizedMinutesTranscript
  }
];

for (const transcript of meetingTranscripts) {
  if (!validateMeetingTranscript(transcript.value)) {
    errors.push(
      `${transcript.name}: schema validation failed: ${ajv.errorsText(
        validateMeetingTranscript.errors,
        { separator: "; " }
      )}`
    );
    continue;
  }
  for (const utterance of transcript.value.utterances) {
    if (utterance.end_ms <= utterance.start_ms) {
      errors.push(`${transcript.name}/${utterance.utterance_id}: end_ms must be after start_ms`);
    }
  }
}

if (
  demoTranscript.utterances.map((utterance) => utterance.text).join("\n") !==
  normalizedMinutesTranscript.utterances.map((utterance) => utterance.text).join("\n")
) {
  errors.push(
    "demo-meeting-transcript.normalized-from-minutes.json: normalized transcript text does not match canonical demo transcript"
  );
}

for (const bundle of extractionBundles) {
  if (!validateExtractionBundle(bundle.value)) {
    errors.push(
      `${bundle.name}: schema validation failed: ${ajv.errorsText(
        validateExtractionBundle.errors,
        { separator: "; " }
      )}`
    );
    continue;
  }

  for (const claim of bundle.value.claims) {
    const expectedHash = `sha256:${createHash("sha256")
      .update(claim.source.quote)
      .digest("hex")}`;
    if (claim.source.quote_hash !== expectedHash) {
      errors.push(`${bundle.name}/${claim.claim_id}: source quote_hash is incorrect`);
    }
    if (claim.source.end_ms <= claim.source.start_ms) {
      errors.push(`${bundle.name}/${claim.claim_id}: source end_ms must be after start_ms`);
    }
    if (claim.source.meeting_id !== bundle.value.meeting.meeting_id) {
      errors.push(`${bundle.name}/${claim.claim_id}: source meeting_id does not match bundle`);
    }
    if (claim.meeting_id !== bundle.value.meeting.meeting_id) {
      errors.push(`${bundle.name}/${claim.claim_id}: claim meeting_id does not match bundle`);
    }
    if (claim.experiment_id !== bundle.value.experiment.experiment_id) {
      errors.push(`${bundle.name}/${claim.claim_id}: claim experiment_id does not match bundle`);
    }
    if (bundle.generatedByExtractor && claim.verification_status !== "IN_REVIEW") {
      errors.push(`${bundle.name}/${claim.claim_id}: extractor output must be IN_REVIEW`);
    }
    if (bundle.generatedByExtractor && claim.review.decision !== "pending") {
      errors.push(`${bundle.name}/${claim.claim_id}: extractor output must require review`);
    }
  }
}

if (!validateWritebackPlan(writebackPlan)) {
  errors.push(
    `demo-writeback-plan.generated.json: schema validation failed: ${ajv.errorsText(
      validateWritebackPlan.errors,
      { separator: "; " }
    )}`
  );
} else {
  const generatedClaimIds = new Set(
    generatedExtractionBundle.claims.map((claim) => claim.claim_id)
  );
  const writebackIdempotencyKeys = new Set();
  const serializedPlan = JSON.stringify(writebackPlan);
  const sensitivePatterns = [
    /https?:\/\/[^\s")\]]*feishu\.cn\/(?:base|docx|docs|wiki|minutes|drive)\b/u,
    /https?:\/\/accounts\.feishu\.cn\/oauth/u,
    /\bbascn[A-Za-z0-9]+\b/u,
    /\bdoxcn[A-Za-z0-9]+\b/u,
    /\bdoccn[A-Za-z0-9]+\b/u,
    /\bshtcn[A-Za-z0-9]+\b/u,
    /\btbl[A-Za-z0-9]{8,}\b/u,
    /\brec[A-Za-z0-9]{8,}\b/u,
    /\bou_[A-Za-z0-9]{8,}\b/u,
    /\bcli_[A-Za-z0-9]{8,}\b/u
  ];

  if (!writebackPlan.safety.gateway_does_not_execute) {
    errors.push("demo-writeback-plan.generated.json: gateway must not execute commands");
  }
  if (!writebackPlan.safety.dry_run_default) {
    errors.push("demo-writeback-plan.generated.json: dry_run_default must be true");
  }
  if (!writebackPlan.safety.requires_human_confirmation_for_write) {
    errors.push("demo-writeback-plan.generated.json: writes must require human confirmation");
  }
  if (sensitivePatterns.some((pattern) => pattern.test(serializedPlan))) {
    errors.push("demo-writeback-plan.generated.json: contains possible real Feishu resource identifier");
  }

  for (const command of writebackPlan.commands) {
    if (writebackIdempotencyKeys.has(command.idempotency_key)) {
      errors.push(`${command.command_id}: duplicate idempotency_key`);
    }
    writebackIdempotencyKeys.add(command.idempotency_key);

    if (!command.command_preview.includes("--dry-run")) {
      errors.push(`${command.command_id}: command_preview must include --dry-run`);
    }
    if (command.profile !== "xtal-writer") {
      errors.push(`${command.command_id}: write command must use xtal-writer`);
    }
    if (command.identity !== "user") {
      errors.push(`${command.command_id}: write command must use user identity`);
    }
    if (!command.requires_dry_run || !command.requires_confirmation) {
      errors.push(`${command.command_id}: write command must require dry-run and confirmation`);
    }
    for (const claimId of command.source_claim_ids) {
      if (!generatedClaimIds.has(claimId)) {
        errors.push(`${command.command_id}: unknown source_claim_id ${claimId}`);
      }
    }
  }
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
    `Meeting transcripts: ${meetingTranscripts.length}`,
    `Extraction bundles: ${extractionBundles.length}`,
    `Writeback commands: ${writebackPlan.commands.length}`
  ].join("\n")
);
