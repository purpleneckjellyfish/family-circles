import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";

/** Homebrew and system locations, for servers started without that bin dir on PATH. */
const EXTRA_BIN_DIRS = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];

let binaries: { ffmpeg: string; ffprobe: string } | null = null;

async function resolveBinary(name: "ffmpeg" | "ffprobe"): Promise<string | null> {
  for (const dir of EXTRA_BIN_DIRS) {
    const candidate = path.join(dir, name);
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      /* try the next location */
    }
  }
  try {
    await runCommand(name, ["-version"], 10_000);
    return name;
  } catch {
    return null;
  }
}

/** True when ffmpeg and ffprobe can be run (required for video). */
export async function ffmpegAvailable(): Promise<boolean> {
  const ffmpeg = await resolveBinary("ffmpeg");
  const ffprobe = await resolveBinary("ffprobe");
  if (!ffmpeg || !ffprobe) {
    binaries = null;
    return false;
  }
  binaries = { ffmpeg, ffprobe };
  return true;
}

async function binary(name: "ffmpeg" | "ffprobe"): Promise<string> {
  if (!binaries) {
    const ok = await ffmpegAvailable();
    if (!ok || !binaries) {
      throw new Error(`${name} is not installed`);
    }
  }
  return binaries[name];
}

function runCommand(
  cmd: string,
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${cmd} timed out`));
    }, timeoutMs);
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-400)}`));
    });
  });
}

export type VideoProbe = {
  durationMs: number | null;
  width: number | null;
  height: number | null;
};

/** Probe duration / size with ffprobe. */
export async function probeVideo(absPath: string): Promise<VideoProbe> {
  const { stdout } = await runCommand(
    await binary("ffprobe"),
    [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      absPath,
    ],
    30_000,
  );
  const data = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{
      codec_type?: string;
      width?: number;
      height?: number;
      duration?: string;
    }>;
  };
  const videoStream = data.streams?.find((s) => s.codec_type === "video");
  const durationSec = Number.parseFloat(
    data.format?.duration || videoStream?.duration || "",
  );
  return {
    durationMs: Number.isFinite(durationSec)
      ? Math.round(durationSec * 1000)
      : null,
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
  };
}

/**
 * Transcode to H.264/AAC MP4 with faststart for browser playback.
 * Scale long edge down to 1280 to keep Unraid boxes comfortable.
 */
export async function transcodeToMp4(opts: {
  inputAbs: string;
  outputAbs: string;
}): Promise<void> {
  await runCommand(
    await binary("ffmpeg"),
    [
      "-y",
      "-i",
      opts.inputAbs,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-vf",
      "scale='min(1280,iw)':-2",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "-pix_fmt",
      "yuv420p",
      opts.outputAbs,
    ],
    // Long clips on slow NAS disks — allow up to 10 minutes.
    600_000,
  );
  await access(opts.outputAbs);
}

/** Grab a still near 1s (or first frame) for poster art. */
export async function extractPoster(opts: {
  inputAbs: string;
  outputAbs: string;
}): Promise<void> {
  try {
    await runCommand(
      await binary("ffmpeg"),
      [
        "-y",
        "-ss",
        "1",
        "-i",
        opts.inputAbs,
        "-frames:v",
        "1",
        "-q:v",
        "3",
        opts.outputAbs,
      ],
      60_000,
    );
    await access(opts.outputAbs);
  } catch {
    await runCommand(
      await binary("ffmpeg"),
      [
        "-y",
        "-i",
        opts.inputAbs,
        "-frames:v",
        "1",
        "-q:v",
        "3",
        opts.outputAbs,
      ],
      60_000,
    );
    await access(opts.outputAbs);
  }
}

/** Sibling poster path for a playable mp4 storage key. */
export function posterStoragePath(videoStoragePath: string) {
  return videoStoragePath.replace(/\.[^.]+$/, "") + "-poster.jpg";
}

/** Sibling original upload path. */
export function sourceStoragePath(videoStoragePath: string, sourceExt: string) {
  const base = videoStoragePath.replace(/\.[^.]+$/, "");
  const ext = sourceExt.startsWith(".") ? sourceExt : `.${sourceExt}`;
  return `${base}-source${ext}`;
}
