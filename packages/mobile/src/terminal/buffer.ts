export interface TerminalStyle {
  fg?: string;
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  underline?: boolean;
  inverse?: boolean;
}

export interface TerminalSpan {
  text: string;
  style: TerminalStyle;
}

export interface TerminalLine {
  id: string;
  spans: TerminalSpan[];
  rawText: string;
}

const DEFAULT_FG = "#d4d4d4";

const ANSI_COLORS_FG: Record<number, string> = {
  30: "#1e1e1e", // Black
  31: "#f44747", // Red
  32: "#608b4e", // Green
  33: "#dcdcaa", // Yellow
  34: "#569cd6", // Blue
  35: "#c586c0", // Magenta
  36: "#4ec9b0", // Cyan
  37: "#d4d4d4", // White
  90: "#808080", // Bright Black (Gray)
  91: "#f14c4c", // Bright Red
  92: "#89d185", // Bright Green
  93: "#ffe9a0", // Bright Yellow
  94: "#9cdcfe", // Bright Blue
  95: "#d16969", // Bright Magenta
  96: "#4fc1ff", // Bright Cyan
  97: "#ffffff", // Bright White
};

const ANSI_COLORS_BG: Record<number, string> = {
  40: "#1e1e1e",
  41: "#f44747",
  42: "#608b4e",
  43: "#dcdcaa",
  44: "#569cd6",
  45: "#c586c0",
  46: "#4ec9b0",
  47: "#d4d4d4",
  100: "#808080",
  101: "#f14c4c",
  102: "#89d185",
  103: "#ffe9a0",
  104: "#9cdcfe",
  105: "#d16969",
  106: "#4fc1ff",
  107: "#ffffff",
};

export interface TerminalBufferOptions {
  maxLines?: number;
}

export class TerminalBuffer {
  private readonly maxLines: number;
  private lines: TerminalLine[] = [];
  private currentSpans: TerminalSpan[] = [];
  private currentRawLine = "";
  private currentCursorCol = 0;
  private currentStyle: TerminalStyle = {};
  private pendingEscape = "";
  private lineCounter = 0;

  constructor(options: TerminalBufferOptions = {}) {
    this.maxLines = options.maxLines ?? 2000;
  }

  public getLines(): readonly TerminalLine[] {
    if (this.currentSpans.length > 0 || this.lines.length === 0) {
      return [
        ...this.lines,
        {
          id: `line_curr_${this.lineCounter}`,
          spans: [...this.currentSpans],
          rawText: this.currentRawLine,
        },
      ];
    }
    return this.lines;
  }

  public getPlainText(): string {
    const all = this.lines.map((l) => l.rawText);
    if (this.currentRawLine.length > 0) {
      all.push(this.currentRawLine);
    }
    return all.join("\n");
  }

  public clear(): void {
    this.lines = [];
    this.currentSpans = [];
    this.currentRawLine = "";
    this.currentCursorCol = 0;
    this.currentStyle = {};
    this.pendingEscape = "";
  }

  public write(chunk: string): void {
    const input = this.pendingEscape ? this.pendingEscape + chunk : chunk;
    this.pendingEscape = "";

    let i = 0;
    const len = input.length;

    while (i < len) {
      const char = input[i]!;

      // 1. Check for Escape character \x1b
      if (char === "\x1b") {
        const remaining = input.slice(i);

        // Check if escape sequence might be cut off at the end of the chunk
        if (remaining.length === 1 || (remaining[1] === "[" && remaining.length < 3)) {
          this.pendingEscape = remaining;
          break;
        }

        // OSC Sequence: \x1b] ... (\x07 | \x1b\)
        if (remaining.startsWith("\x1b]")) {
          const bellEnd = remaining.indexOf("\x07");
          const stEnd = remaining.indexOf("\x1b\\");

          let oscEnd = -1;
          let endLen = 1;
          if (bellEnd !== -1 && (stEnd === -1 || bellEnd < stEnd)) {
            oscEnd = bellEnd;
            endLen = 1;
          } else if (stEnd !== -1) {
            oscEnd = stEnd;
            endLen = 2;
          }

          if (oscEnd !== -1) {
            i += oscEnd + endLen;
            continue;
          } else {
            // Cut off OSC sequence
            this.pendingEscape = remaining;
            break;
          }
        }

        // CSI Sequence: \x1b[ ... [A-Za-z~]
        if (remaining.startsWith("\x1b[")) {
          const match = remaining.match(/^\x1b\[([?0-9;]*)([A-Za-z~])/);
          if (match) {
            const fullMatch = match[0];
            const params = match[1] ?? "";
            const cmd = match[2] ?? "";
            this.handleCsiCommand(cmd, params);
            i += fullMatch.length;
            continue;
          } else {
            // Incomplete CSI sequence
            if (remaining.length < 32) {
              this.pendingEscape = remaining;
              break;
            }
            // Skip unrecognized escape
            i += 2;
            continue;
          }
        }

        // Unrecognized or 2-char escape (e.g. \x1b=, \x1b>)
        if (remaining.length >= 2) {
          i += 2;
          continue;
        }
      }

      // 2. Control Characters
      if (char === "\r") {
        this.handleCarriageReturn();
        i++;
        continue;
      }

      if (char === "\n") {
        this.handleNewLine();
        i++;
        continue;
      }

      if (char === "\b") {
        this.handleBackspace();
        i++;
        continue;
      }

      if (char === "\t") {
        this.insertText("    ");
        i++;
        continue;
      }

      // Skip non-printable ascii control codes (except space and printable chars)
      const code = char.charCodeAt(0);
      if (code < 32 && code !== 9) {
        i++;
        continue;
      }

      // 3. Normal printable character
      this.insertText(char);
      i++;
    }
  }

  private handleCarriageReturn(): void {
    // Rewind cursor to column 0 of current line
    this.currentCursorCol = 0;
  }

  private handleNewLine(): void {
    this.lines.push({
      id: `line_${this.lineCounter++}`,
      spans: [...this.currentSpans],
      rawText: this.currentRawLine,
    });

    if (this.lines.length > this.maxLines) {
      this.lines.splice(0, this.lines.length - this.maxLines);
    }

    this.currentSpans = [];
    this.currentRawLine = "";
    this.currentCursorCol = 0;
  }

  private handleBackspace(): void {
    if (this.currentCursorCol > 0) {
      this.currentCursorCol--;
    }
  }

  private insertText(text: string): void {
    if (this.currentCursorCol >= this.currentRawLine.length) {
      // Appending at the end
      this.appendSpanText(text);
      this.currentRawLine += text;
      this.currentCursorCol = this.currentRawLine.length;
    } else {
      // Overwriting existing text (e.g. after carriage return)
      const overwriteLen = text.length;
      const before = this.currentRawLine.slice(0, this.currentCursorCol);
      const after = this.currentRawLine.slice(this.currentCursorCol + overwriteLen);
      this.currentRawLine = before + text + after;

      // Re-slice spans to reflect overwritten section
      this.rebuildSpansAfterOverwrite(this.currentCursorCol, text);
      this.currentCursorCol += text.length;
    }
  }

  private appendSpanText(text: string): void {
    const lastSpan = this.currentSpans[this.currentSpans.length - 1];
    if (lastSpan && this.stylesEqual(lastSpan.style, this.currentStyle)) {
      lastSpan.text += text;
    } else {
      this.currentSpans.push({
        text,
        style: { ...this.currentStyle },
      });
    }
  }

  private rebuildSpansAfterOverwrite(startCol: number, newText: string): void {
    // Simple, robust span update for in-place overwrites
    const newSpans: TerminalSpan[] = [];
    let currentIdx = 0;

    for (const span of this.currentSpans) {
      const spanEnd = currentIdx + span.text.length;
      if (spanEnd <= startCol) {
        newSpans.push(span);
      } else if (currentIdx >= startCol + newText.length) {
        newSpans.push(span);
      } else {
        // Partially or fully overlapping
        if (currentIdx < startCol) {
          newSpans.push({
            text: span.text.slice(0, startCol - currentIdx),
            style: span.style,
          });
        }
      }
      currentIdx = spanEnd;
    }

    // Insert new styled text
    newSpans.push({
      text: newText,
      style: { ...this.currentStyle },
    });

    this.currentSpans = newSpans;
  }

  private handleCsiCommand(cmd: string, params: string): void {
    if (cmd === "m") {
      // SGR: Select Graphic Rendition (Colors and Text Styles)
      this.handleSgr(params);
      return;
    }

    if (cmd === "K") {
      // Erase in line
      const mode = parseInt(params, 10) || 0;
      if (mode === 0) {
        // Clear from cursor to end of line
        this.currentRawLine = this.currentRawLine.slice(0, this.currentCursorCol);
        this.truncateSpansToCol(this.currentCursorCol);
      } else if (mode === 2) {
        // Clear entire line
        this.currentRawLine = "";
        this.currentSpans = [];
        this.currentCursorCol = 0;
      }
      return;
    }

    if (cmd === "J") {
      // Erase in display
      const mode = parseInt(params, 10) || 0;
      if (mode === 2 || mode === 3) {
        // Clear entire display / scrollback
        this.clear();
      }
    }
  }

  private truncateSpansToCol(col: number): void {
    const newSpans: TerminalSpan[] = [];
    let cur = 0;
    for (const span of this.currentSpans) {
      if (cur + span.text.length <= col) {
        newSpans.push(span);
        cur += span.text.length;
      } else {
        const keepLen = Math.max(0, col - cur);
        if (keepLen > 0) {
          newSpans.push({
            text: span.text.slice(0, keepLen),
            style: span.style,
          });
        }
        break;
      }
    }
    this.currentSpans = newSpans;
  }

  private handleSgr(paramStr: string): void {
    if (!paramStr || paramStr === "0") {
      this.currentStyle = {};
      return;
    }

    const parts = paramStr.split(";").map((p) => parseInt(p, 10) || 0);
    let i = 0;

    while (i < parts.length) {
      const code = parts[i]!;

      if (code === 0) {
        this.currentStyle = {};
      } else if (code === 1) {
        this.currentStyle.bold = true;
      } else if (code === 2) {
        this.currentStyle.dim = true;
      } else if (code === 4) {
        this.currentStyle.underline = true;
      } else if (code === 7) {
        this.currentStyle.inverse = true;
      } else if (code === 22) {
        delete this.currentStyle.bold;
        delete this.currentStyle.dim;
      } else if (code === 24) {
        delete this.currentStyle.underline;
      } else if (code === 27) {
        delete this.currentStyle.inverse;
      } else if (code >= 30 && code <= 37) {
        this.currentStyle.fg = ANSI_COLORS_FG[code];
      } else if (code === 39) {
        delete this.currentStyle.fg;
      } else if (code >= 40 && code <= 47) {
        this.currentStyle.bg = ANSI_COLORS_BG[code];
      } else if (code === 49) {
        delete this.currentStyle.bg;
      } else if (code >= 90 && code <= 97) {
        this.currentStyle.fg = ANSI_COLORS_FG[code];
      } else if (code >= 100 && code <= 107) {
        this.currentStyle.bg = ANSI_COLORS_BG[code];
      } else if (code === 38 || code === 48) {
        // 256 colors or 24-bit truecolor
        const isBg = code === 48;
        const mode = parts[i + 1];
        if (mode === 5 && parts[i + 2] !== undefined) {
          // 256 color lookup
          const colorIndex = parts[i + 2]!;
          const hex = this.get256ColorHex(colorIndex);
          if (isBg) {
            this.currentStyle.bg = hex;
          } else {
            this.currentStyle.fg = hex;
          }
          i += 2;
        } else if (mode === 2 && parts[i + 4] !== undefined) {
          // RGB truecolor: 38;2;r;g;b
          const r = parts[i + 2]!;
          const g = parts[i + 3]!;
          const b = parts[i + 4]!;
          const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
          if (isBg) {
            this.currentStyle.bg = hex;
          } else {
            this.currentStyle.fg = hex;
          }
          i += 4;
        }
      }
      i++;
    }
  }

  private get256ColorHex(idx: number): string {
    if (idx < 16) {
      if (idx < 8) return ANSI_COLORS_FG[30 + idx] || DEFAULT_FG;
      return ANSI_COLORS_FG[90 + (idx - 8)] || DEFAULT_FG;
    }
    if (idx >= 232) {
      // Grayscale ramp (24 shades)
      const gray = Math.round(((idx - 232) / 23) * 255);
      return `#${gray.toString(16).padStart(2, "0")}${gray.toString(16).padStart(2, "0")}${gray.toString(16).padStart(2, "0")}`;
    }
    // 6x6x6 color cube: 16 + 36*r + 6*g + b
    const c = idx - 16;
    const r = Math.floor(c / 36);
    const g = Math.floor((c % 36) / 6);
    const b = c % 6;
    const val = (x: number) => (x === 0 ? 0 : 55 + x * 40);
    return `#${val(r).toString(16).padStart(2, "0")}${val(g).toString(16).padStart(2, "0")}${val(b).toString(16).padStart(2, "0")}`;
  }

  private stylesEqual(a: TerminalStyle, b: TerminalStyle): boolean {
    return (
      a.fg === b.fg &&
      a.bg === b.bg &&
      a.bold === b.bold &&
      a.dim === b.dim &&
      a.underline === b.underline &&
      a.inverse === b.inverse
    );
  }
}
