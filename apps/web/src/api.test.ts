import { describe, expect, it } from "vitest";
import { type DeviceInfo, isTimeoutFailure } from "./api";

describe("API transport failures", () => {
  it("recognizes browser abort and timeout errors as retryable timeouts", () => {
    expect(isTimeoutFailure(new DOMException("aborted", "AbortError"))).toBe(true);
    expect(isTimeoutFailure(new DOMException("timed out", "TimeoutError"))).toBe(true);
  });

  it("does not label an ordinary network error as a timeout", () => {
    expect(isTimeoutFailure(new TypeError("Failed to fetch"))).toBe(false);
    expect(isTimeoutFailure("offline")).toBe(false);
  });

  it("supports suggestedProjectsRoot in DeviceInfo with neutral fallback", () => {
    const withSuggestion: DeviceInfo = {
      instanceId: "inst-1",
      name: "node-1",
      platform: "win32",
      canManage: true,
      projectsDirectory: "C:\\Projects",
      suggestedProjectsRoot: "D:\\YoYoTVProjects",
    };
    expect(withSuggestion.suggestedProjectsRoot || "输入完整文件夹路径").toBe("D:\\YoYoTVProjects");

    const withoutSuggestion: DeviceInfo = {
      instanceId: null,
      name: "remote",
      platform: "linux",
      canManage: false,
      projectsDirectory: null,
    };
    expect(withoutSuggestion.suggestedProjectsRoot || "输入完整文件夹路径").toBe(
      "输入完整文件夹路径",
    );
  });
});
