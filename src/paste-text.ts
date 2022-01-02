export const pasteText = (fullLines: string[], prefix: string = "") => {
  console.log(2, fullLines);
  const leadingWhitespace = fullLines[0].match(/^(\s*).*/)[1];
  const clipboardTextIndented = fullLines
    .join("\n")
    .replaceAll(/\n/g, "\n" + leadingWhitespace + prefix);
  const replacementText = prefix + clipboardTextIndented;

  console.log(8, replacementText);

  return replacementText;
};
