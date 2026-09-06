import {
  addIcon,
  App,
  base64ToArrayBuffer,
  getBlobArrayBuffer,
  Editor,
  EditorTransaction,
  FileSystemAdapter,
  FuzzySuggestModal,
  htmlToMarkdown,
  MarkdownView,
  Notice,
  Platform,
  Plugin,
  PluginSettingTab,
  Setting,
} from "obsidian";

import {
  toggleQuote,
  toggleQuoteInEditor,
} from "./src/toggle-quote";

import * as pluginIcons from "./icons.json";

enum Mode {
  Text = "Text",
  TextBlockquote = "Text (Blockquote)",
  Markdown = "Markdown",
  MarkdownBlockquote = "Markdown (Blockquote)",
  CodeBlock = "Code Block",
  CodeBlockBlockquote = "Code Block (Blockquote)",
  Passthrough = "Passthrough",
}

const MODE_VALUES = Object.values(Mode);
const MODE_ENTRIES = Object.entries(Mode);

const CURRENT_FILE_PLACEHOLDER = "{current}";

const LEADING_WHITESPACE_REGEX = /^(\s*)(.*)/;

const timestamp = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
};

const isURL = (str: string): boolean => {
  if (str.startsWith("app://")) {
    return false;
  }
  try {
    new URL(str);
    return true;
  } catch (e) {
    return false;
  }
};

const isLinkToImage = (url: string): boolean => {
  return /\.(jpg|jpeg|png|webp|avif|gif)$/.test(url);
};

const createTFileObject = async (
  fileName: string,
  arrayBuffer: ArrayBuffer,
  app: App
) => {
  let tfileObject = await app.vault.createBinary(fileName, arrayBuffer);

  // Per the API spec (https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts#L3626),
  // createBinary() is supposed to return a Promise<TFile>, but seems
  // at least currently to return a Promise<null>, so we handle that
  // here:
  if (tfileObject === null) {
    console.log(
      "Paste Mode: Waiting for pasted file to become available..."
    );
    // Wait for the Obsidian metadata cache to catch up to the
    // newly-created file. Per https://discord.com/channels/686053708261228577/840286264964022302/1038065182812942417,
    // there is currently no way to force a metadata cache refresh,
    // unfortunately.
    let nFileTries = 0;
    while (!tfileObject && nFileTries < 30) {
      if (nFileTries > 0) {
        console.log(
          `Paste Mode: Waiting for pasted file to become available... (attempt ${nFileTries + 1})`
        );
      }
      if (nFileTries === 10) {
        new Notice(
          `Paste Mode: Waiting for pasted file to become available...`
        );
      }

      tfileObject = app.metadataCache.getFirstLinkpathDest(fileName, "");

      nFileTries += 1;
      if (!tfileObject) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  }

  if (tfileObject === null) {
    new Notice(
      `Error: Pasted file created at ${fileName}, but the plugin cannot currently access it. (This is not an error caused by anything you did.)`
    );
  }

  return tfileObject;
};

const createAttachmentFileName = (extension: string): string => {
  const ts = timestamp();
  return `Pasted image ${ts}.${extension}`;
};

class PasteModeModal extends FuzzySuggestModal<number> {
  public readonly onChooseItem: (item: number) => void;
  public readonly currentValue: Mode;
  public readonly showCurrentValue: boolean;
  public readonly clipboardReadWorks: boolean;
  public readonly showPassthroughMode: boolean;

  constructor({
    app,
    onChooseItem,
    currentValue,
    showCurrentValue,
    clipboardReadWorks,
    showPassthroughMode,
  }: {
    app: App;
    onChooseItem: (patternIndex: number) => void;
    currentValue: Mode;
    showCurrentValue: boolean;
    clipboardReadWorks: boolean;
    showPassthroughMode: boolean;
  }) {
    super(app);

    this.clipboardReadWorks = clipboardReadWorks;
    this.showPassthroughMode = showPassthroughMode;

    if (showCurrentValue) {
      this.setPlaceholder(`Current: ${currentValue}`);
    }

    this.setInstructions([
      {
        command: `Paste Mode`,
        purpose: "",
      },
    ]);

    this.onChooseItem = (patternIndex: number) => {
      onChooseItem(patternIndex);
      // Note: Using this.close() here was causing a bug whereby new
      // text was unable to be typed until the user had opened another
      // modal or switched away from the window. @lishid noted at
      // https://github.com/obsidianmd/obsidian-releases/pull/396#issuecomment-894017526
      // that the modal is automatically closed at the conclusion of
      // onChooseItem.
    };
  }

  getItems(): number[] {
    const results: number[] = [];
    MODE_VALUES.forEach((mode, index) => {
      if (mode === Mode.Passthrough && !this.showPassthroughMode) {
        return;
      }
      if (
        (mode === Mode.Markdown || mode === Mode.MarkdownBlockquote) &&
        !this.clipboardReadWorks
      ) {
        return;
      }
      results.push(index);
    });
    return results;
  }

  getItemText(index: number): string {
    return MODE_VALUES[index];
  }
}

export interface AttachmentLocation {
  cursorFilePattern: string;
  targetLocation: string;
}

interface PastetoIndentationPluginSettings {
  blockquotePrefix: string;
  mode: Mode;
  saveBase64EncodedFiles: boolean;
  saveFilesLocation: string;
  saveFilesOverrideLocations: AttachmentLocation[];
  escapeCharactersInBlockquotes: boolean;
  blockquoteEscapeCharactersRegex: string;
  escapeCharactersInNonBlockquotes: boolean;
  nonBlockquoteEscapeCharactersRegex: string;
  srcAttributeCopyRegex: string;
  continueListItems: boolean;
}

const defaultBlockquoteEscapeCharacters = "(==|<)";
const defaultNonBlockquoteEscapeCharacters = "(\\[)";
const defaultSrcAttributeCopyRegex = "";

const DEFAULT_SETTINGS: PastetoIndentationPluginSettings = {
  blockquotePrefix: "> ",
  mode: Mode.Markdown,
  saveBase64EncodedFiles: false,
  saveFilesLocation: "Attachments",
  saveFilesOverrideLocations: [],
  escapeCharactersInBlockquotes: false,
  blockquoteEscapeCharactersRegex: defaultBlockquoteEscapeCharacters,
  escapeCharactersInNonBlockquotes: false,
  nonBlockquoteEscapeCharactersRegex: defaultNonBlockquoteEscapeCharacters,
  srcAttributeCopyRegex: defaultSrcAttributeCopyRegex,
  continueListItems: false,
};

for (const [key, value] of Object.entries(pluginIcons)) {
  addIcon(key, value);
}

export default class PastetoIndentationPlugin extends Plugin {
  settings: PastetoIndentationPluginSettings;
  statusBar: HTMLElement;
  clipboardReadWorks: boolean;

  private getIconName(baseName: string): string {
    if (!this.app.isDarkMode()) {
      return baseName;
    }
    return baseName + '-dark';
  }

  async onload() {
    await this.loadSettings();

    // Test whether the clipboard allows .read() (vs. just .readText()):
    this.clipboardReadWorks = Platform.isDesktopApp;

    const changePasteMode = async (value: Mode) => {
      this.settings.mode = value;
      await this.saveSettings();
      this.statusBar.setText(`Paste Mode: ${value}`);
    };

    this.addSettingTab(new SettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on(
        "editor-paste",
        async (evt: ClipboardEvent, editor: Editor) => {
          // Per https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts#L3690,
          // "Check for `evt.defaultPrevented` before attempting to handle this
          // event, and return if it has been already handled."
          if (evt.defaultPrevented) {
            return;
          }

          let mode = this.settings.mode;

          if (mode === Mode.Passthrough) {
            return;
          }

          // Allow other plugins to handle plain URLs (e.g., auto-embed)
          const clipboardText = evt.clipboardData.getData("text")?.trim() || "";
          if (clipboardText && isURL(clipboardText) && !isLinkToImage(clipboardText)) {
            return;
          }

          evt.preventDefault();

          const app = this.app;

          let clipboardContents = "";
          let output = "";

          const files = evt.clipboardData.files;
          const fileLinks: string[] = [];
          const activeFile = app.workspace.getActiveFile();
          const activeFilePath = activeFile?.path;

          for (const fileObject of files) {
            const fileName = await app.fileManager.getAvailablePathForAttachment(
              createAttachmentFileName(fileObject.type.split("/")[1]),
              activeFilePath
            );

            const tfileObject = await createTFileObject(
              fileName,
              await fileObject.arrayBuffer(),
              app
            );

            if (!tfileObject) {
              continue;
            }

            const link = this.app.fileManager.generateMarkdownLink(
              tfileObject,
              activeFilePath
            );

            // Prepend ! to image links so they display as images
            const imageLink = fileObject.type.startsWith("image/") ? `!${link}` : link;

            fileLinks.push(imageLink);
          }

          if (mode === Mode.Markdown || mode === Mode.MarkdownBlockquote) {
            const clipboardHtml = evt.clipboardData.getData("text/html");

            const parser = new DOMParser();
            const htmlDom = parser.parseFromString(clipboardHtml, "text/html");

            // Find all elements with a src attribute:
            const srcContainingElements = htmlDom.querySelectorAll("[src]");
            const srcRegex = this.settings.srcAttributeCopyRegex
              ? new RegExp(this.settings.srcAttributeCopyRegex)
              : null;

            for (const [i, el] of srcContainingElements.entries()) {
              const src = el.getAttr("src");
              if (!srcRegex || !srcRegex.test(src)) {
                continue;
              }

              let dataBlob: Blob | undefined;

              // app://obsidian.md URLs are relative paths prepended by Obsidian;
              // we cannot resolve them, so skip.
              if (src.startsWith("app://obsidian.md")) {
                continue;
              }

              if (src.startsWith("file://")) {
                let urlForDownloading = decodeURI(src).replace(/^file:\/{2}/, "");

                if (/^\/[A-Za-z]:/.test(urlForDownloading)) {
                  // Windows: remove extra leading slash
                  urlForDownloading = urlForDownloading.replace(/^\//, '');
                }

                dataBlob = new Blob([
                  await FileSystemAdapter.readLocalFile(urlForDownloading),
                ]);
              } else {
                dataBlob = await (await fetch(src)).blob();
              }

              if (!dataBlob) {
                continue;
              }

              const fileName = await app.fileManager.getAvailablePathForAttachment(
                createAttachmentFileName(src.split(".").pop()!),
                activeFilePath
              );
              const tfileObject = await createTFileObject(
                fileName,
                await getBlobArrayBuffer(dataBlob),
                app
              );

              const encodedPath = encodeURI(tfileObject.path);
              el.setAttr("src", encodedPath);
              el.setAttr("alt", encodedPath.replaceAll('\n', ' '));
            }

            clipboardContents = htmlToMarkdown(htmlDom.documentElement.innerHTML);

            // htmlToMarkdown() returns a blank string when there's
            // no HTML to convert — fall back to the equivalent Text mode:
            if (clipboardContents === "") {
              mode = mode === Mode.Markdown ? Mode.Text : Mode.TextBlockquote;
            }
          }

          if (
            mode === Mode.Text ||
            mode === Mode.TextBlockquote ||
            mode === Mode.CodeBlock ||
            mode === Mode.CodeBlockBlockquote
          ) {
            clipboardContents = evt.clipboardData.getData("text");
          }

          const leadingWhitespaceMatch = editor
            .getLine(editor.getCursor().line)
            .match(LEADING_WHITESPACE_REGEX);
          const leadingWhitespace =
            leadingWhitespaceMatch !== null ? leadingWhitespaceMatch[1] : "";

          // Additional indent to accommodate bullet list markers like `- ` / `* `:
          const additionalLeadingWhitespace =
            leadingWhitespaceMatch !== null &&
              leadingWhitespaceMatch[2] !== undefined
              ? " ".repeat(Math.min(leadingWhitespaceMatch[2].length, 3))
              : "";

          if (
            this.settings.saveBase64EncodedFiles &&
            mode !== Mode.CodeBlock &&
            mode !== Mode.CodeBlockBlockquote
          ) {
            const images = [
              ...clipboardContents.matchAll(
                /data:image\/(?<extension>.*?);base64,\s*(?<data>[A-Za-z0-9\+\/]*)\b={0,2}/g
              ),
            ];

            // Reverse so string replacements don't invalidate later indices:
            for (const image of images.reverse()) {
              const imageFileName = await app.fileManager.getAvailablePathForAttachment(
                createAttachmentFileName(image.groups.extension),
                activeFilePath
              );

              await app.vault.createBinary(
                imageFileName,
                base64ToArrayBuffer(image.groups.data)
              );

              clipboardContents =
                clipboardContents.substring(0, image.index) +
                `${encodeURI(imageFileName)}` +
                clipboardContents.substring(
                  image.index + image[0].length,
                  clipboardContents.length
                );
            }
          }

          const clipboardLines = clipboardContents.split("\n");

          // Detect if we're in a list context and extract the list marker
          let listMarker = "";
          if (this.settings.continueListItems && leadingWhitespaceMatch && leadingWhitespaceMatch[2]) {
            const lineContent = leadingWhitespaceMatch[2];
            // Match bullet markers (- , * , + ) with optional checkboxes
            const bulletMatch = lineContent.match(/^([-*+]\s*(?:\[[ xX]\]\s*)?)/);
            // Match numbered list markers (1. , 2. , etc.)
            const numberedMatch = lineContent.match(/^(\d+\.\s*(?:\[[ xX]\]\s*)?)/);

            if (bulletMatch) {
              listMarker = bulletMatch[1];
            } else if (numberedMatch) {
              // For numbered lists, we'll increment the number for each line
              listMarker = numberedMatch[1];
            }
          }

          const input = [
            ...(clipboardLines.some((l) => l !== "") ? clipboardLines : []),
            ...fileLinks,
          ].map((line, i) => {
            if (i === 0) {
              return line;
            }

            let linePrefix = leadingWhitespace + additionalLeadingWhitespace;

            // Apply list marker if we're continuing list items
            if (listMarker && i <= clipboardLines.length) {
              const numberedMatch = listMarker.match(/^(\d+)\./);
              if (numberedMatch) {
                // For numbered lists, increment the number
                const currentNumber = parseInt(numberedMatch[1]) + i - 1;
                linePrefix = leadingWhitespace + listMarker.replace(/^\d+\./, currentNumber + ".");
              } else {
                // For bullet lists, just use the same marker
                linePrefix = leadingWhitespace + listMarker;
              }
            }

            return linePrefix + line;
          });

          if (mode === Mode.Text || mode === Mode.Markdown) {
            output = input.join("\n");

            if (this.settings.escapeCharactersInNonBlockquotes) {
              output = this.escapeNonBlockquoteCharacters(output);
            }
          }

          if (mode === Mode.CodeBlock) {
            output = `\`\`\`\n${leadingWhitespace}${input.join(
              "\n"
            )}\n${leadingWhitespace}\`\`\``;
          }

          if (mode === Mode.CodeBlockBlockquote) {
            const fencedInput = [
              "```",
              leadingWhitespace + input[0],
              ...input.slice(1),
              leadingWhitespace + "```",
            ];

            const toggledText = toggleQuote(
              fencedInput,
              this.settings.blockquotePrefix
            );
            toggledText.lines[0] = toggledText.lines[0].replace(
              new RegExp(`^${leadingWhitespace}`),
              ""
            );

            output = toggledText.lines.join("\n");

            if (this.settings.escapeCharactersInBlockquotes) {
              output = this.escapeBlockquoteCharacters(output);
            }

            const transaction: EditorTransaction = {
              replaceSelection: output,
            };

            editor.transaction(transaction);
            return;
          }

          if (
            mode === Mode.TextBlockquote ||
            mode === Mode.MarkdownBlockquote
          ) {
            const toggledText = toggleQuote(
              [leadingWhitespace + input[0], ...input.slice(1)],
              this.settings.blockquotePrefix
            );
            toggledText.lines[0] = toggledText.lines[0].replace(
              new RegExp(`^${leadingWhitespace}`),
              ""
            );

            output = toggledText.lines.join("\n");

            if (this.settings.escapeCharactersInBlockquotes) {
              output = this.escapeBlockquoteCharacters(output);
            }
          }

          const transaction: EditorTransaction = {
            replaceSelection: output,
          };

          editor.transaction(transaction);
        }
      ));

    MODE_ENTRIES.forEach(([key, value]) => {
      this.addCommand({
        id: `set-paste-mode-${key}`,
        icon: this.getIconName(`pasteIcons-${key}`),
        name: `Set Paste Mode to ${value}`,
        callback: () => changePasteMode(value),
      });
    });

    const pasteInMode = async (
      value: Mode,
      editor: Editor,
      view: MarkdownView
    ) => {
      // This follows https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/read#browser_compatibility,
      // for requesting access to the .read() (vs. .readText())
      // clipboard method:
      const originalMode = this.settings.mode;
      changePasteMode(value);
      const transfer = new DataTransfer();
      if (this.clipboardReadWorks) {
        const clipboardData = await navigator.clipboard.read();
        for (let i = 0; i < clipboardData.length; i++) {
          for (const format of clipboardData[i].types) {
            const typeContents = await (
              await clipboardData[i].getType(format)
            ).text();
            transfer.setData(format, typeContents);
          }
        }
      } else {
        transfer.setData("text/plain", await navigator.clipboard.readText());
      }
      this.app.workspace.trigger(
        "editor-paste",
        new ClipboardEvent("paste", {
          clipboardData: transfer,
        }),
        editor,
        view
      );
      changePasteMode(originalMode);
    };

    MODE_ENTRIES.forEach(([key, value]) => {
      // Passthrough doesn't work with synthetic clipboard events:
      if (value === Mode.Passthrough) {
        return;
      }
      if (
        (value === Mode.Markdown || value === Mode.MarkdownBlockquote) &&
        !this.clipboardReadWorks
      ) {
        return;
      }

      this.addCommand({
        id: `paste-in-mode-${key}`,
        icon: this.getIconName(`pasteIcons-${key}-hourglass`),
        name: `Paste in ${value} Mode`,
        editorCallback: async (editor: Editor, view: MarkdownView) => {
          await pasteInMode(value, editor, view);
        },
      });
    });

    this.addCommand({
      id: `cycle-paste-mode`,
      icon: this.getIconName(`pasteIcons-clipboard-cycle`),
      name: `Cycle Paste Mode`,
      callback: async () => {
        const currentIndex = MODE_VALUES.indexOf(this.settings.mode);
        const nextIndex = (currentIndex + 1) % MODE_VALUES.length;
        const newPasteMode = MODE_VALUES[nextIndex];

        await changePasteMode(newPasteMode);
        new Notice(`Paste mode changed to ${newPasteMode}`);
      },
    });

    this.addCommand({
      id: "toggle-blockquote-at-current-indentation",
      name: "Toggle blockquote at current indentation",
      icon: this.getIconName("pasteIcons-quote-text"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) {
          return false;
        }
        if (!checking) {
          toggleQuoteInEditor(view, this.settings.blockquotePrefix);
        }
        return true;
      },
    });

    this.addCommand({
      id: "set-paste-mode",
      icon: this.getIconName("pasteIcons-clipboard-question"),
      name: "Set paste mode",
      callback: () => {
        const newMode = new PasteModeModal({
          app,
          onChooseItem,
          currentValue: this.settings.mode,
          showCurrentValue: true,
          // This is set to true because clipboard.read()
          // won't be used directly, so modes don't need to
          // be filtered as they do elsewhere:
          clipboardReadWorks: true,
          showPassthroughMode: true,
        });
        newMode.open();
      },
    });

    this.addCommand({
      id: "paste-in-mode-interactive",
      icon: this.getIconName("pasteIcons-clipboard-question"),
      name: "Paste in Mode (Interactive)",
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        const newMode = new PasteModeModal({
          app,
          onChooseItem: async (item: number): Promise<void> => {
            const selection = Object.values(Mode)[item];
            await pasteInMode(selection, editor, view);
          },
          currentValue: null,
          showCurrentValue: false,
          clipboardReadWorks: this.clipboardReadWorks,
          showPassthroughMode: false,
        });
        newMode.open();
      },
    });

    this.statusBar = this.addStatusBarItem();
    this.statusBar.setText(`Paste Mode: ${this.settings.mode}`);
    const onChooseItem = async (item: number): Promise<void> => {
      const selection = Object.values(Mode)[item];
      await changePasteMode(selection);
    };
    const app = this.app;
    this.statusBar.onClickEvent(() => {
      const newMode = new PasteModeModal({
        app,
        onChooseItem,
        currentValue: this.settings.mode,
        showCurrentValue: true,
        clipboardReadWorks: this.clipboardReadWorks,
        showPassthroughMode: true,
      });
      newMode.open();
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    if (!Object.values(Mode).includes(this.settings.mode)) {
      this.settings.mode = Object.values(Mode)[0];
      this.saveSettings();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  escapeBlockquoteCharacters(output: string): string {
    const regex = new RegExp(this.settings.blockquoteEscapeCharactersRegex, "g");
    const indices = [...output.matchAll(regex)]
      .map((x) => x.index!)
      .reverse();

    for (const index of indices) {
      // Don't add a backslash if one already precedes the character:
      if (output[index - 1] !== "\\") {
        output = output.substring(0, index) + "\\" + output.substring(index);
      }
    }

    return output;
  }

  escapeNonBlockquoteCharacters(output: string): string {
    const regex = new RegExp(this.settings.nonBlockquoteEscapeCharactersRegex, "g");
    const indices = [...output.matchAll(regex)]
      .map((x) => x.index!)
      .reverse();

    for (const index of indices) {
      // Don't add a backslash if one already precedes the character:
      if (output[index - 1] !== "\\") {
        output = output.substring(0, index) + "\\" + output.substring(index);
      }
    }

    return output;
  }
}

class SettingTab extends PluginSettingTab {
  plugin: PastetoIndentationPlugin;

  constructor(app: App, plugin: PastetoIndentationPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Paste Mode" });

    if (!this.plugin.clipboardReadWorks) {
      const noticeDiv = containerEl.createDiv();
      noticeDiv
        .createEl("span", { text: "Notice: " })
        .addClass("paste-mode-settings-notice");
      noticeDiv
        .createEl("span", {
          text: `The "Paste in Markdown Mode" and "Paste in Markdown (Blockquote) Mode" attachmentOverrideLocations have been disabled, because reading non-text data from the clipboad does not work with this version of Obsidian.`,
        })
        .addClass("paste-mode-settings-notice-text");
    }

    new Setting(containerEl)
      .setName("Paste Mode")
      .setDesc("Mode that the paste attachmentLocation will invoke.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption(Mode.Text, "Plain Text")
          .addOption(Mode.TextBlockquote, "Plain Text (Blockquote)")
          .addOption(Mode.Markdown, "Markdown")
          .addOption(Mode.MarkdownBlockquote, "Markdown (Blockquote)")
          .addOption(Mode.Passthrough, "Passthrough")
          .setValue(this.plugin.settings.mode)
          .onChange(async (value) => {
            this.plugin.settings.mode = value as Mode;
            await this.plugin.saveSettings();
            this.plugin.statusBar.setText(
              `Paste Mode: ${this.plugin.settings.mode}`
            );
          })
      );

    new Setting(containerEl)
      .setName("Save base64-encoded files")
      .setDesc(
        "When pasting in Text, Text (Blockquote), Markdown, or Markdown (Blockquote) mode, save any base64-encoded text as a file, and replace it in the pasted text with a reference to that saved file."
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.saveBase64EncodedFiles)
          .onChange(async (value) => {
            this.plugin.settings.saveBase64EncodedFiles = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Blockquote Prefix")
      .setDesc(
        "Markdown syntax to signify that a line is part of a blockquote."
      )
      .addText((text) =>
        text
          .setPlaceholder(">•")
          .setValue(
            this.plugin.settings.blockquotePrefix ===
              DEFAULT_SETTINGS.blockquotePrefix
              ? ""
              : this.plugin.settings.blockquotePrefix
          )
          .onChange(async (value) => {
            this.plugin.settings.blockquotePrefix =
              value !== "" ? value : DEFAULT_SETTINGS.blockquotePrefix;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Continue list items")
      .setDesc(
        "When pasting multiple lines into a list item where all lines are at the same indentation level, add list markers to each pasted line to continue the list."
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.continueListItems)
          .onChange(async (value) => {
            this.plugin.settings.continueListItems = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Escape characters in blockquotes")
      .setDesc(
        `When pasting in Text (Blockquote), Code Block (Blockquote), or Markdown (Blockquote) mode, add a backslash escape character to the beginning of specific characters.`
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.escapeCharactersInBlockquotes)
          .onChange(async (value) => {
            this.plugin.settings.escapeCharactersInBlockquotes = value;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    new Setting(containerEl)
      .setName("Escape characters regex")
      .setDesc(
        `A Regular Expression expressing which characters to escape when pasting in Text (Blockquote), Code Block (Blockquote), or Markdown (Blockquote) mode.`
      )
      .setDisabled(!this.plugin.settings.escapeCharactersInBlockquotes)
      .addText((text) => {
        text
          .setValue(
            this.plugin.settings.blockquoteEscapeCharactersRegex ||
            defaultBlockquoteEscapeCharacters
          )
          .setPlaceholder(defaultBlockquoteEscapeCharacters)
          .onChange(async (value) => {
            this.plugin.settings.blockquoteEscapeCharactersRegex =
              value || defaultBlockquoteEscapeCharacters;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Escape characters in normal text")
      .setDesc(
        `When pasting in Text or Markdown mode, add a backslash escape character to the beginning of specific characters.`
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.escapeCharactersInNonBlockquotes)
          .onChange(async (value) => {
            this.plugin.settings.escapeCharactersInNonBlockquotes = value;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    new Setting(containerEl)
      .setName("Escape characters in normal text regex")
      .setDesc(
        `A Regular Expression expressing which characters to escape when pasting in Text or Markdown mode.`
      )
      .setDisabled(!this.plugin.settings.escapeCharactersInNonBlockquotes)
      .addText((text) => {
        text
          .setValue(
            this.plugin.settings.nonBlockquoteEscapeCharactersRegex ||
            defaultNonBlockquoteEscapeCharacters
          )
          .setPlaceholder(defaultNonBlockquoteEscapeCharacters)
          .onChange(async (value) => {
            this.plugin.settings.nonBlockquoteEscapeCharactersRegex =
              value || defaultNonBlockquoteEscapeCharacters;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("src attribute copy regex")
      .setDesc(
        `If set, when pasting in Markdown or Markdown (Blockquote) mode, watch for any HTML elements that contain a src attribute. If the src value matches this Regular Expression, copy the file being referenced into the Obsidian vault, and replace the src attribute with a reference to that now-local copy of the file.`
      )
      .addText((text) => {
        text
          .setValue(
            this.plugin.settings.srcAttributeCopyRegex ||
            defaultSrcAttributeCopyRegex
          )
          .onChange(async (value) => {
            this.plugin.settings.srcAttributeCopyRegex =
              value || defaultSrcAttributeCopyRegex;
            await this.plugin.saveSettings();
          });
      });

    const attachmentsEl = containerEl.createEl("div");
    attachmentsEl.addClass("attachment-locations");
    attachmentsEl.createEl("h3", {
      text: "Attachments",
    });

    new Setting(attachmentsEl)
      .setName("Default attachment folder path")
      .setDesc(
        `When saving files from the clipboard, place them in this folder. ("{current}" will insert the directory of the currently-open note.)`
      )
      .addText((text) => {
        text
          .setValue(this.plugin.settings.saveFilesLocation)
          .onChange(async (value) => {
            this.plugin.settings.saveFilesLocation = value;
            await this.plugin.saveSettings();
          });
      });

    const attachmentOverrideLocationsEl = attachmentsEl.createEl("div");
    attachmentOverrideLocationsEl.addClass("attachment-locations");
    attachmentOverrideLocationsEl.createEl("h4", {
      text: "Attachment overrides",
    });

    const attachmentOverrideLocations =
      this.plugin.settings.saveFilesOverrideLocations;
    for (const [
      attachmentLocationIndex,
      attachmentLocation,
    ] of attachmentOverrideLocations.entries()) {
      const attachmentLocationEl =
        attachmentOverrideLocationsEl.createEl("div");
      attachmentLocationEl.addClass("attachment-override");

      let deleteAttachmentLocationPrimed = false;
      let attachmentLocationDeletePrimerTimer: ReturnType<
        typeof setTimeout
      > | null;

      new Setting(attachmentLocationEl)
        .setName("Current file directory")
        .setDesc("If the current file is in this directory...")
        .addText((text) => {
          text
            .setValue(attachmentLocation.cursorFilePattern)
            .onChange(async (value) => {
              this.plugin.settings.saveFilesOverrideLocations[
                attachmentLocationIndex
              ].cursorFilePattern = value;
              await this.plugin.saveSettings();
            });
        });

      new Setting(attachmentLocationEl)
        .setName("Saved file target location")
        .setDesc('...Save a pasted file into this directory. ("{current}" will insert the directory of the currently-open note.)')
        .addText((text) => {
          text
            .setValue(attachmentLocation.targetLocation)
            .onChange(async (value) => {
              this.plugin.settings.saveFilesOverrideLocations[
                attachmentLocationIndex
              ].targetLocation = value;
              await this.plugin.saveSettings();
            });
        });

      new Setting(attachmentLocationEl)
        .setName("Delete location rule")
        .addButton((button) => {
          button
            .setButtonText("Delete")
            .setClass("paste-mode-settings-delete-button")
            .setTooltip("Delete override location")
            .onClick(async () => {
              if (attachmentLocationDeletePrimerTimer) {
                clearTimeout(attachmentLocationDeletePrimerTimer);
              }
              if (deleteAttachmentLocationPrimed) {
                this.plugin.settings.saveFilesOverrideLocations.splice(
                  attachmentLocationIndex,
                  1
                );

                await this.plugin.saveSettings();
                this.display();
                return;
              }

              attachmentLocationDeletePrimerTimer = setTimeout(
                () => {
                  deleteAttachmentLocationPrimed = false;
                  attachmentLocationEl.removeClass("primed");
                },
                1000 * 4 // 4 second timeout
              );
              deleteAttachmentLocationPrimed = true;
              attachmentLocationEl.addClass("primed");

              new Notice(
                `Click again to delete attachmentLocation ${attachmentLocationIndex + 1
                }`
              );
            });
        });
    }

    const addattachmentLocationButtonEl =
      attachmentOverrideLocationsEl.createEl("div", {
        cls: "add-attachmentLocation-button-el",
      });

    new Setting(addattachmentLocationButtonEl).addButton((button) => {
      button
        .setButtonText("Add attachment override location")
        .setClass("add-attachmentLocation-button")
        .onClick(async () => {
          this.plugin.settings.saveFilesOverrideLocations.push({
            cursorFilePattern: "",
            targetLocation: "",
          });
          await this.plugin.saveSettings();
          this.display();
        });
    });
  }
}
