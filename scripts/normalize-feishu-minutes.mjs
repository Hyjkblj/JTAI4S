import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = {
    input: resolve(root, "fixtures", "feishu", "minutes-detail-transcript.sample.redacted.json"),
    output: resolve(root, "evaluation", "demo-meeting-transcript.normalized-from-minutes.json"),
    meetingId: "MTG-DEMO-002",
    experimentId: "EXP-DEMO-002",
    projectId: "PROJECT-XTALLOOP-DEMO",
    experimentType: "synthesis",
    experimentStatus: "PLANNING",
    startedAt: "2026-07-18T10:00:00+08:00",
    endedAt: "2026-07-18T10:08:00+08:00",
    dataOrigin: "deidentified",
    extractedAt: "2026-07-18T12:05:00+08:00"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--input") {
      args.input = resolve(root, value);
      index += 1;
    } else if (arg === "--output") {
      args.output = resolve(root, value);
      index += 1;
    } else if (arg === "--meeting-id") {
      args.meetingId = value;
      index += 1;
    } else if (arg === "--experiment-id") {
      args.experimentId = value;
      index += 1;
    } else if (arg === "--project-id") {
      args.projectId = value;
      index += 1;
    } else if (arg === "--experiment-type") {
      args.experimentType = value;
      index += 1;
    } else if (arg === "--experiment-status") {
      args.experimentStatus = value;
      index += 1;
    } else if (arg === "--started-at") {
      args.startedAt = value;
      index += 1;
    } else if (arg === "--ended-at") {
      args.endedAt = value;
      index += 1;
    } else if (arg === "--data-origin") {
      args.dataOrigin = value;
      index += 1;
    } else if (arg === "--extracted-at") {
      args.extractedAt = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function parseTimestampToMs(value) {
  if (typeof value === "number") {
    return Math.trunc(value);
  }
  if (typeof value !== "string") {
    return null;
  }
  const match = value.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/u);
  if (!match) {
    return null;
  }
  const [, hours, minutes, seconds, millis = "0"] = match;
  return (
    Number(hours) * 60 * 60 * 1000 +
    Number(minutes) * 60 * 1000 +
    Number(seconds) * 1000 +
    Number(millis.padEnd(3, "0"))
  );
}

function findMinuteEnvelope(raw) {
  if (Array.isArray(raw?.data?.minutes) && raw.data.minutes.length > 0) {
    return raw.data.minutes[0];
  }
  if (raw?.data?.minute) {
    return raw.data.minute;
  }
  if (raw?.minute) {
    return raw.minute;
  }
  if (raw?.transcript || raw?.transcripts) {
    return raw;
  }
  throw new Error("Cannot find a Feishu Minutes envelope with transcript content.");
}

function findTranscript(minute) {
  const candidates = [
    minute.transcript,
    minute.transcripts,
    minute.artifacts?.transcript,
    minute.data?.transcript
  ];
  const transcript = candidates.find((candidate) => candidate);
  if (!transcript) {
    throw new Error("Cannot find transcript in Feishu Minutes detail output.");
  }
  return transcript;
}

function makeSpeakerRedactor() {
  const map = new Map();
  return (rawSpeaker) => {
    const key = String(rawSpeaker || "unknown-speaker");
    if (!map.has(key)) {
      map.set(key, `SPEAKER-${String(map.size + 1).padStart(2, "0")}`);
    }
    return map.get(key);
  };
}

function normalizeArrayTranscript(transcript, redactor) {
  return transcript
    .map((item, index) => {
      const text = String(
        firstDefined(item.text, item.content, item.utterance, item.sentence, "")
      ).trim();
      if (!text) {
        return null;
      }

      const startMs = firstDefined(
        item.start_ms,
        item.startTimeMs,
        item.start_time_ms,
        item.start_time,
        item.start
      );
      const endMs = firstDefined(
        item.end_ms,
        item.endTimeMs,
        item.end_time_ms,
        item.end_time,
        item.end
      );
      const normalizedStart = parseTimestampToMs(startMs) ?? index * 8000;
      const normalizedEnd =
        parseTimestampToMs(endMs) ?? normalizedStart + Math.max(3000, text.length * 180);
      const rawSpeaker = firstDefined(
        item.speaker_id,
        item.speakerId,
        item.speaker?.id,
        item.speaker_name,
        item.speakerName,
        item.speaker,
        item.user_name,
        item.userName
      );

      return {
        speaker_id: redactor(rawSpeaker),
        speaker_role: String(firstDefined(item.speaker_role, item.role, "unknown")),
        start_ms: normalizedStart,
        end_ms: Math.max(normalizedStart + 1, normalizedEnd),
        text
      };
    })
    .filter(Boolean);
}

function normalizeTextTranscript(transcript, redactor) {
  const lines = transcript.split(/\r?\n/u).map((line) => line.trim());
  const blocks = [];
  let current = null;

  for (const line of lines) {
    if (!line) {
      continue;
    }
    const header = line.match(/^(.+?)\s+(\d{1,2}:\d{2}:\d{2}(?:\.\d{1,3})?)$/u);
    if (header) {
      if (current) {
        blocks.push(current);
      }
      current = {
        speaker: header[1],
        start_ms: parseTimestampToMs(header[2]),
        textLines: []
      };
    } else if (current) {
      current.textLines.push(line);
    }
  }
  if (current) {
    blocks.push(current);
  }

  return blocks
    .map((block, index) => {
      const text = block.textLines.join("\n").trim();
      if (!text) {
        return null;
      }
      const nextStart = blocks[index + 1]?.start_ms;
      const startMs = block.start_ms ?? index * 8000;
      const endMs = nextStart ?? startMs + Math.max(3000, text.length * 180);
      return {
        speaker_id: redactor(block.speaker),
        speaker_role: "unknown",
        start_ms: startMs,
        end_ms: Math.max(startMs + 1, endMs),
        text
      };
    })
    .filter(Boolean);
}

function normalizeTranscript(transcript) {
  const redactor = makeSpeakerRedactor();
  if (Array.isArray(transcript)) {
    return normalizeArrayTranscript(transcript, redactor);
  }
  if (typeof transcript === "string") {
    return normalizeTextTranscript(transcript, redactor);
  }
  throw new Error("Unsupported transcript format. Expected array or text transcript.");
}

function addUtteranceIds(utterances, meetingId) {
  const suffix = meetingId.replace(/^MTG-/u, "");
  return utterances.map((utterance, index) => ({
    utterance_id: `UTT-${suffix}-${String(index + 1).padStart(3, "0")}`,
    ...utterance
  }));
}

function normalizeFeishuMinutes(raw, args) {
  const minute = findMinuteEnvelope(raw);
  const transcript = findTranscript(minute);
  const utterances = addUtteranceIds(normalizeTranscript(transcript), args.meetingId);

  return {
    schema_version: "1.0.0",
    data_origin: args.dataOrigin,
    extracted_at: args.extractedAt,
    meeting: {
      meeting_id: args.meetingId,
      title: String(firstDefined(minute.title, "Feishu Minutes transcript")).slice(0, 128),
      started_at: args.startedAt,
      ended_at: args.endedAt,
      source_system: "feishu_minutes"
    },
    experiment: {
      experiment_id: args.experimentId,
      project_id: args.projectId,
      experiment_type: args.experimentType,
      status: args.experimentStatus
    },
    utterances
  };
}

const args = parseArgs(process.argv.slice(2));
const raw = await readJson(args.input);
const normalized = normalizeFeishuMinutes(raw, args);

await mkdir(dirname(args.output), { recursive: true });
await writeFile(args.output, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");

console.log(
  [
    `Normalized ${normalized.utterances.length} utterances.`,
    `Meeting: ${normalized.meeting.meeting_id}`,
    `Experiment: ${normalized.experiment.experiment_id}`,
    `Source: ${normalized.meeting.source_system}`,
    `Output: ${args.output}`
  ].join("\n")
);
