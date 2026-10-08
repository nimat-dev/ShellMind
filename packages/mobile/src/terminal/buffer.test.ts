import { describe, it, expect } from "vitest";
import { TerminalBuffer } from "./buffer.js";

describe("TerminalBuffer", () => {
  it("ingests plain text lines and splits on newlines", () => {
    const buffer = new TerminalBuffer();
    buffer.write("hello world\n");
    buffer.write("second line\n");

    const lines = buffer.getLines();
    expect(lines.length).toBe(2);
    expect(lines[0]?.rawText).toBe("hello world");
    expect(lines[1]?.rawText).toBe("second line");
    expect(buffer.getPlainText()).toBe("hello world\nsecond line");
  });

  it("parses standard ANSI 16 colors and styles (SGR)", () => {
    const buffer = new TerminalBuffer();
    // \x1b[31m = Red, \x1b[1m = Bold, \x1b[0m = Reset
    buffer.write("\x1b[31;1mError:\x1b[0m normal text\n");

    const lines = buffer.getLines();
    expect(lines.length).toBe(1);
    const spans = lines[0]?.spans;
    expect(spans).toBeDefined();
    expect(spans?.length).toBe(2);

    expect(spans?.[0]?.text).toBe("Error:");
    expect(spans?.[0]?.style.fg).toBe("#f44747");
    expect(spans?.[0]?.style.bold).toBe(true);

    expect(spans?.[1]?.text).toBe(" normal text");
    expect(spans?.[1]?.style.fg).toBeUndefined();
    expect(spans?.[1]?.style.bold).toBeUndefined();
  });

  it("handles carriage return \\r by overwriting line content from start", () => {
    const buffer = new TerminalBuffer();
    // Simulate download progress bar: [==>  ] 50% \r [====>] 100%
    buffer.write("[==>  ] 50%\r[====>] 100%\n");

    const lines = buffer.getLines();
    expect(lines.length).toBe(1);
    expect(lines[0]?.rawText).toBe("[====>] 100%");
  });

  it("handles chunked/split ANSI sequences cleanly", () => {
    const buffer = new TerminalBuffer();
    // First chunk ends in partial escape sequence
    buffer.write("Hello \x1b[3");
    // Second chunk finishes the sequence
    buffer.write("2mGreen\x1b[0m\n");

    const lines = buffer.getLines();
    expect(lines.length).toBe(1);
    const spans = lines[0]?.spans;
    expect(spans?.length).toBe(2);
    expect(spans?.[0]?.text).toBe("Hello ");
    expect(spans?.[1]?.text).toBe("Green");
    expect(spans?.[1]?.style.fg).toBe("#608b4e"); // Green
  });

  it("strips OSC window title and terminal URL sequences", () => {
    const buffer = new TerminalBuffer();
    // OSC 0 Title and OSC 7 directory
    buffer.write("\x1b]0;ShellMind Terminal\x07\x1b]7;file://nr/Users/user\x1b\\prompt$ ls\n");

    const lines = buffer.getLines();
    expect(lines.length).toBe(1);
    expect(lines[0]?.rawText).toBe("prompt$ ls");
  });

  it("enforces max scrollback lines limit", () => {
    const buffer = new TerminalBuffer({ maxLines: 3 });
    for (let i = 1; i <= 6; i++) {
      buffer.write(`line ${i}\n`);
    }

    const lines = buffer.getLines();
    expect(lines.length).toBe(3);
    expect(lines[0]?.rawText).toBe("line 4");
    expect(lines[1]?.rawText).toBe("line 5");
    expect(lines[2]?.rawText).toBe("line 6");
  });

  it("handles erase in line \\x1b[2K and clear display \\x1b[2J", () => {
    const buffer = new TerminalBuffer();
    buffer.write("dirty line\x1b[2Kclean line\n");

    const lines = buffer.getLines();
    expect(lines.length).toBe(1);
    expect(lines[0]?.rawText).toBe("clean line");

    // Clear display
    buffer.write("\x1b[2J");
    expect(buffer.getLines().length).toBe(1); // Only current empty line remains
    expect(buffer.getPlainText()).toBe("");
  });

  it("handles 256-color and 24-bit RGB truecolor escape codes", () => {
    const buffer = new TerminalBuffer();
    // 38;5;208 (256 color orange) and 38;2;100;150;200 (truecolor rgb)
    buffer.write("\x1b[38;5;208mOrange\x1b[0m \x1b[38;2;100;150;200mCustomRGB\x1b[0m\n");

    const lines = buffer.getLines();
    expect(lines.length).toBe(1);
    const spans = lines[0]?.spans;
    expect(spans?.length).toBe(3);
    expect(spans?.[0]?.text).toBe("Orange");
    expect(spans?.[0]?.style.fg).toBeDefined();
    expect(spans?.[2]?.text).toBe("CustomRGB");
    expect(spans?.[2]?.style.fg).toBe("#6496c8"); // 100, 150, 200 in hex
  });
});
