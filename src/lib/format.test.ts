import { describe, it, expect } from "vitest";
import { formatBytes, formatDuration, formatSpeed } from "./types";

describe("formatBytes", () => {
  it("returns B for small values", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
  });
  it("returns KB / MB / GB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1.00 GB");
  });
  it("handles bad input", () => {
    expect(formatBytes(NaN)).toBe("—");
    expect(formatBytes(-1)).toBe("—");
  });
});

describe("formatDuration", () => {
  it("seconds for < 60s", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(45)).toBe("45s");
  });
  it("minutes for < 1h", () => {
    expect(formatDuration(60)).toBe("1m 0s");
    expect(formatDuration(125)).toBe("2m 5s");
  });
  it("hours for >= 1h", () => {
    expect(formatDuration(3600)).toBe("1h 0m");
    expect(formatDuration(3661)).toBe("1h 1m");
  });
});

describe("formatSpeed", () => {
  it("0 for no traffic", () => {
    expect(formatSpeed(0)).toBe("0 B/s");
    expect(formatSpeed(NaN)).toBe("0 B/s");
  });
  it("KB/s for typical", () => {
    expect(formatSpeed(1024)).toBe("1.0 KB/s");
  });
});
