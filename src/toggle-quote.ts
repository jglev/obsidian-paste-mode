import { MarkdownView } from 'obsidian';

// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping,
// which, as a code snippet, is in the public domain, per
// https://developer.mozilla.org/en-US/docs/MDN/About#copyrights_and_licenses
// (as of 2021-07-15):
export const escapeRegExp = (string: string) => {
  // $& means the whole matched string:
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const LEADING_WHITESPACE_REGEX = /^(\s*)/;

export const toggleQuote = (
  linesInput: string[],
  prefix: string
): {
  lines: string[];
  minLeadingWhitespaceLength: number;
  isEveryLinePrefixed: boolean;
} => {
  const fullLines = [...linesInput];
  const escapedPrefix = escapeRegExp(prefix);

  const leadingWhitespaces = fullLines.map((e: string) => {
    const whitespaceMatch = e.match(LEADING_WHITESPACE_REGEX);
    return whitespaceMatch?.[1] ?? "";
  });

  // Get rid of blank lines, which might be part of multi-line passages:
  const nonBlankLeadingLengths = leadingWhitespaces
    .filter((_e, i) => fullLines[i] !== "")
    .map((e) => e.length);

  // Account for if all lines actually *are* unindented:
  const minLeadingWhitespaceLength = Math.min(
    ...(nonBlankLeadingLengths.length > 0 ? nonBlankLeadingLengths : [0])
  );

  // Make an educated guess about using tabs vs spaces (lacking access to the
  // "Use Tabs" setting value in Obsidian for now) by repurposing the first
  // actual instance of leading whitespace:
  const exampleLeadingWhitespace = leadingWhitespaces.find(
    (e) => e.length === minLeadingWhitespaceLength
  );

  const indentation =
    exampleLeadingWhitespace && exampleLeadingWhitespace.length > 0
      ? exampleLeadingWhitespace
      : " ".repeat(minLeadingWhitespaceLength);

  const prefixedLineRegex = new RegExp(
    `^\\s{${minLeadingWhitespaceLength}}${escapedPrefix}`
  );

  // Determine whether *every* line is Prefixed or not:
  const isEveryLinePrefixed = fullLines.every((e) => {
    if (e === "") {
      return true; // blank lines don't affect the decision
    }
    return e.match(prefixedLineRegex) !== null;
  });

  // Update the text in-place:
  for (const [i, text] of fullLines.entries()) {
    if (text === "") {
      fullLines[i] = isEveryLinePrefixed ? indentation : indentation + prefix;
      continue;
    }

    if (isEveryLinePrefixed) {
      fullLines[i] = text.replace(
        prefixedLineRegex,
        "$1"
      );
      continue;
    }

    // If the prefix is already in the correct place, do not add to it:
    if (!text.match(prefixedLineRegex)) {
      fullLines[i] = text.replace(
        new RegExp(`^(\\s{${minLeadingWhitespaceLength}})`),
        `$1${prefix}`
      );
    }
  }

  return {
    lines: fullLines,
    minLeadingWhitespaceLength,
    isEveryLinePrefixed,
  };
};

export const toggleQuoteInEditor = async (
  view: MarkdownView,
  prefix: string
): Promise<void> => {
  const editor = view.editor;
  const currentSelectionStart = editor.getCursor("from");
  const currentSelectionEnd = editor.getCursor("to");

  const replacementRange = [
    { line: currentSelectionStart.line, ch: 0 },
    {
      line: currentSelectionEnd.line,
      ch: editor.getLine(currentSelectionEnd.line).length,
    },
  ];

  const fullSelectedLines = editor
    .getRange(replacementRange[0], replacementRange[1])
    .split("\n");

  const { lines, minLeadingWhitespaceLength, isEveryLinePrefixed } =
    toggleQuote(fullSelectedLines, prefix);

  editor.replaceRange(
    lines.join("\n"),
    replacementRange[0],
    replacementRange[1]
  );

  const adjustedCh = (ch: number) =>
    ch < minLeadingWhitespaceLength
      ? ch
      : isEveryLinePrefixed
        ? ch - prefix.length
        : ch + prefix.length;

  editor.setSelection(
    {
      line: currentSelectionStart.line,
      ch: adjustedCh(currentSelectionStart.ch),
    },
    {
      line: currentSelectionEnd.line,
      ch: adjustedCh(currentSelectionEnd.ch),
    }
  );
};
