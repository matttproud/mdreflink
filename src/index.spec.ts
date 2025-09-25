import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  MockInstance,
} from "vitest";
import { promises as fs } from "fs";
import { run, Console } from "./index.js";

describe("CLI entrypoint", () => {
  const VERSION_PATTERN = /^\d+\.\d+\.\d+/;

  let consoleSpy: Console;
  let processExitSpy: MockInstance;
  let processStdoutWriteSpy: MockInstance;
  let readFileMock: MockInstance;
  let writeFileMock: MockInstance;

  beforeEach(() => {
    consoleSpy = {
      log: vi.fn(),
      error: vi.fn(),
    };

    processExitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as never);
    processStdoutWriteSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    readFileMock = vi.spyOn(fs, "readFile").mockResolvedValue("");
    writeFileMock = vi.spyOn(fs, "writeFile").mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should show help when --help flag is used", async () => {
    await run({ _: [], help: true }, consoleSpy);

    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining("mdreflink - Convert Markdown inline links"),
    );
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining("USAGE:"),
    );
    expect(processStdoutWriteSpy).not.toHaveBeenCalled();
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("should show help when -h flag is used", async () => {
    await run({ _: [], h: true }, consoleSpy);

    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining("mdreflink - Convert Markdown inline links"),
    );
    expect(processStdoutWriteSpy).not.toHaveBeenCalled();
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("should show version when --version flag is used", async () => {
    await run({ _: [], version: true }, consoleSpy);

    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringMatching(VERSION_PATTERN),
    );
    expect(processStdoutWriteSpy).not.toHaveBeenCalled();
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("should show version when -v flag is used", async () => {
    await run({ _: [], v: true }, consoleSpy);

    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringMatching(VERSION_PATTERN),
    );
    expect(processStdoutWriteSpy).not.toHaveBeenCalled();
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("should show statistics when --stats flag is used", async () => {
    const inputMarkdown = `[hello](world) and [goodbye](moon)`;
    const filePath = "test.md";

    readFileMock.mockResolvedValue(inputMarkdown);

    await run({ _: [filePath], stats: true }, consoleSpy);

    expect(consoleSpy.error).toHaveBeenCalledWith("Links converted: 2");
    expect(consoleSpy.error).toHaveBeenCalledWith("Conflicts found: 0");
    expect(consoleSpy.error).toHaveBeenCalledWith("Definitions added: 2");
    expect(processStdoutWriteSpy).toHaveBeenCalled();
  });

  it("should output stats to stderr when using stdout for content", async () => {
    const inputMarkdown = `[test](url)`;
    const filePath = "test.md";

    readFileMock.mockResolvedValue(inputMarkdown);

    await run({ _: [filePath], stats: true }, consoleSpy);

    expect(consoleSpy.error).toHaveBeenCalledWith("Links converted: 1");
    expect(consoleSpy.error).toHaveBeenCalledWith("Conflicts found: 0");
    expect(consoleSpy.error).toHaveBeenCalledWith("Definitions added: 1");

    expect(processStdoutWriteSpy).toHaveBeenCalledWith(
      expect.stringContaining("[test]"),
    );

    expect(processStdoutWriteSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Links converted"),
    );
  });

  it("should process a file and write to stdout", async () => {
    const inputMarkdown = `[hello](world)`;
    const expectedOutput = `[hello]

[hello]: world
`;
    const filePath = "test.md";

    readFileMock.mockResolvedValue(inputMarkdown);

    await run({ _: [filePath] }, consoleSpy);

    expect(fs.readFile).toHaveBeenCalledWith(filePath, "utf8");
    expect(processStdoutWriteSpy).toHaveBeenCalledWith(expectedOutput);
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("should process a file and write in-place", async () => {
    const inputMarkdown = `[hello](world)`;
    const expectedOutput = `[hello]

[hello]: world
`;
    const filePath = "test.md";

    readFileMock.mockResolvedValue(inputMarkdown);

    await run({ _: [filePath], w: true }, consoleSpy);

    expect(fs.readFile).toHaveBeenCalledWith(filePath, "utf8");
    expect(writeFileMock).toHaveBeenCalledWith(
      filePath,
      expectedOutput,
      "utf8",
    );
    expect(processStdoutWriteSpy).not.toHaveBeenCalled();
  });

  it("should handle file not found error", async () => {
    const filePath = "nonexistent.md";
    const error = new Error("File not found") as Error & {
      code: string;
      path: string;
    };
    error.code = "ENOENT";
    error.path = filePath;

    readFileMock.mockRejectedValue(error);

    await expect(run({ _: [filePath] }, consoleSpy)).rejects.toThrow(error);
  });

  it("should not call console or process.exit during normal operation", async () => {
    const inputMarkdown = `[hello](world)`;
    const filePath = "test.md";

    readFileMock.mockResolvedValue(inputMarkdown);

    await run({ _: [filePath] }, consoleSpy);

    expect(consoleSpy.error).not.toHaveBeenCalled();
    expect(consoleSpy.log).not.toHaveBeenCalled();
    expect(processExitSpy).not.toHaveBeenCalled();
  });
});
