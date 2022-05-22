import { MarkdownView } from 'obsidian';

// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping,
// which, as a code snippet, is in the public domain, per 
// https://developer.mozilla.org/en-US/docs/MDN/About#copyrights_and_licenses
// (as of 2021-07-15):
export const escapeRegExp = (string: string) => {
  // $& means the whole matched string:
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export const toggleQuote = async (
  linesInput: string[],
  prefix: string
): Promise<{
  lines: string[];
  minLeadingWhitespaceLength: number;
  isEveryLinePrefixed: boolean;
}> => {
  const fullLines = [...linesInput];
  const escapedPrefix = escapeRegExp(prefix);

  const leadingWhitespaces = fullLines.map((e: string) => {
    const whitespaceMatch = e.match(new RegExp(`^(\\s*)`));
    return whitespaceMatch !== null ? whitespaceMatch[1] : "";
  });
  // This is in its own variable to aid in debugging:
  let filteredLeadingWhitespaces = leadingWhitespaces.filter(
    (e: string, i: number) => {
      // Get rid of blank lines, which might be part of multi-line
      // passages:
      return fullLines[i] !== "";
    }
  );

  // Account for if all lines actually *are* unindented, and we thus
  // filtered all lines out immediately above:
  const filteredLeadingLengths = (
    filteredLeadingWhitespaces.length > 0 ? filteredLeadingWhitespaces : [""]
  ).map((e: string) => e.length);
  const minLeadingWhitespaceLength = Math.min(...filteredLeadingLengths);

  // Determine whether *every* line is Prefixed or not. If not, we will
  // add the prefix to every line; if so, we will remove it from every line.
  const isEveryLinePrefixed = fullLines.every((e: string) => {
    const prefixMatch = e.match(
      new RegExp(`^\\s{${minLeadingWhitespaceLength}}${escapedPrefix}`)
    );
    if (prefixMatch !== null) {
      return true;
    }
    return false;
  });

  // Make an educated guess about using tabs vs spaces (lacking access to the
  // "Use Tabs" setting value in Obsidian for now) by just repurposing the
  // first actual instance of leading whitespace:
  const exampleLeadingWhitespace = leadingWhitespaces.filter(
    (e) => e.length === minLeadingWhitespaceLength
  );
  // Update the text in-place:
  for (const [i, text] of fullLines.entries()) {
    if (isEveryLinePrefixed === true) {
      if (text === "") {
        fullLines[i] =
          exampleLeadingWhitespace.length > 0
            ? exampleLeadingWhitespace[0]
            : " ".repeat(minLeadingWhitespaceLength);
        continue;
      }
      fullLines[i] = text.replace(
        new RegExp(`^(\\s{${minLeadingWhitespaceLength}})${escapedPrefix}`),
        "$1"
      );
      continue;
    }

    if (text === "") {
      fullLines[i] =
        (exampleLeadingWhitespace.length > 0
          ? exampleLeadingWhitespace[0]
          : " ".repeat(minLeadingWhitespaceLength)) + prefix;
      continue;
    }

    // If the prefix is already in the correct place, do not add to it:
    if (
      !text.match(
        new RegExp(`^\\s{${minLeadingWhitespaceLength}}${escapedPrefix}`)
      )
    ) {
      fullLines[i] = text.replace(
        new RegExp(`^(\\s{${minLeadingWhitespaceLength}})`),
        `$1${prefix}`
      );
    }
  }

  return {
    lines: fullLines,
    minLeadingWhitespaceLength: minLeadingWhitespaceLength,
    isEveryLinePrefixed: isEveryLinePrefixed,
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
    await toggleQuote(fullSelectedLines, prefix);

  editor.replaceRange(
    lines.join("\n"),
    replacementRange[0],
    replacementRange[1]
  );

  let newSelectionStartCh;
  if (currentSelectionStart.ch < minLeadingWhitespaceLength) {
    newSelectionStartCh = currentSelectionStart.ch;
  } else {
    if (isEveryLinePrefixed) {
      newSelectionStartCh = currentSelectionStart.ch - prefix.length;
    } else {
      newSelectionStartCh = currentSelectionStart.ch + prefix.length;
    }
  }

  let newSelectionEndCh;
  if (currentSelectionEnd.ch < minLeadingWhitespaceLength) {
    newSelectionEndCh = currentSelectionEnd.ch;
  } else {
    if (isEveryLinePrefixed) {
      newSelectionEndCh = currentSelectionEnd.ch - prefix.length;
    } else {
      newSelectionEndCh = currentSelectionEnd.ch + prefix.length;
    }
  }

  editor.setSelection(
    {
      line: currentSelectionStart.line,
      ch: newSelectionStartCh,
    },
    {
      line: currentSelectionEnd.line,
      ch: newSelectionEndCh,
    }
  );
};
