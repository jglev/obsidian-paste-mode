import cloneDeep from "lodash.clonedeep";
import {
  addIcon,
  apiVersion,
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
  escapeRegExp,
  toggleQuote,
  toggleQuoteInEditor,
} from "./src/toggle-quote";

const moment = require("moment");

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
    tfileObject = app.metadataCache.getFirstLinkpathDest(fileName, "");
    while (!tfileObject && nFileTries < 30) {
      console.log(
        `Paste Mode: Waiting for pasted file to become available... (attempt ${nFileTries + 1
        })`
      );
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

const createImageFileName = async (
  fileLocation: string,
  extension: string
): Promise<string> => {
  let imageFileName = `${fileLocation || "."}/Pasted image ${moment().format(
    "YYYYMMDDHHmmss"
  )}.${extension}`;

  // Address race condition whereby if multiple image files exist
  // on the clipboard, they will all be saved to the same name:
  let imageFileNameIndex = 0;
  let imageFileNameWithIndex = imageFileName;
  while (await app.vault.adapter.exists(imageFileNameWithIndex)) {
    imageFileNameWithIndex = `${fileLocation || "."
      }/Pasted image ${moment().format(
        "YYYYMMDDHHmmss"
      )}_${imageFileNameIndex}.${extension}`;
    imageFileNameIndex += 1;
  }
  imageFileName = imageFileNameWithIndex;

  return imageFileName;
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
    const filteredModes = Object.keys(Mode)
      .map((key, index) => {
        if (
          (this.showPassthroughMode &&
            Object.values(Mode)[index] === Mode.Passthrough) ||
          (Object.values(Mode)[index] !== Mode.Passthrough &&
            ((Object.values(Mode)[index] !== Mode.Markdown &&
              Object.values(Mode)[index] !== Mode.MarkdownBlockquote) ||
              this.clipboardReadWorks === true))
        ) {
          return index;
        } else {
          return null;
        }
      })
      .filter((originalIndex) => originalIndex !== null);
    return filteredModes;
  }

  getItemText(index: number): string {
    return Object.values(Mode)[index];
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
  apiVersion: number;
  escapeCharactersInBlockquotes: boolean;
  blockquoteEscapeCharactersRegex: string;
  srcAttributeCopyRegex: string;
}

const defaultBlockquoteEscapeCharacters = "(==|<)";
const defaultSrcAttributeCopyRegex = "";

const DEFAULT_SETTINGS: PastetoIndentationPluginSettings = {
  blockquotePrefix: "> ",
  mode: Mode.Markdown,
  saveBase64EncodedFiles: false,
  saveFilesLocation: "Attachments",
  saveFilesOverrideLocations: [],
  apiVersion: 5,
  escapeCharactersInBlockquotes: false,
  blockquoteEscapeCharactersRegex: defaultBlockquoteEscapeCharacters,
  srcAttributeCopyRegex: defaultSrcAttributeCopyRegex,
};

for (const [key, value] of Object.entries(pluginIcons)) {
  addIcon(key, value);
}

export default class PastetoIndentationPlugin extends Plugin {
  settings: PastetoIndentationPluginSettings;
  statusBar: HTMLElement;
  clipboardReadWorks: boolean;

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

    this.app.workspace.on(
      "editor-paste",
      async (evt: ClipboardEvent, editor: Editor) => {
        // Per https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts#L3690,
        // "Check for `evt.defaultPrevented` before attempting to handle this
        // event, and return if it has been already handled."
        if (evt.defaultPrevented) {
          return;
        }
        evt.preventDefault();

        let mode = this.settings.mode;

        if (mode === Mode.Passthrough) {
          return;
        }

        let clipboardContents = "";
        let output = "";

        // TODO: Add setting here.
        // if (evt.clipboardData.types.every((type) => type === "files")) {
        //   return;
        // }
        const files = evt.clipboardData.files;
        const fileLinks = [];
        const activeFile = this.app.workspace.getActiveFile();

        let filesTargetLocation = this.settings.saveFilesLocation;
        let longestMatchingCursorFilePattern = 0;
        this.settings.saveFilesOverrideLocations.forEach((location) => {
          if (
            activeFile.path.startsWith(location.cursorFilePattern) &&
            location.cursorFilePattern.length > longestMatchingCursorFilePattern
          ) {
            filesTargetLocation = location.targetLocation;
            longestMatchingCursorFilePattern =
              location.cursorFilePattern.length;
          }
        });

        if (files.length) {
          if (!(await app.vault.adapter.exists(filesTargetLocation))) {
            await app.vault.createFolder(filesTargetLocation);
          }
        }

        for (var i = 0; i < files.length; i++) {
          const fileObject = files[i];

          const fileName = await createImageFileName(
            filesTargetLocation,
            fileObject.type.split("/")[1]
          );

          const tfileObject = await createTFileObject(
            fileName,
            await fileObject.arrayBuffer(),
            app
          );

          if (tfileObject === undefined) {
            continue;
          }

          const link = this.app.fileManager.generateMarkdownLink(
            tfileObject,
            this.app.workspace.getActiveFile().path
          );

          fileLinks.push(link);
        }

        if (mode === Mode.Markdown || mode === Mode.MarkdownBlockquote) {
          let clipboardHtml = evt.clipboardData.getData("text/html");

          const parser = new DOMParser();
          const htmlDom = parser.parseFromString(clipboardHtml, "text/html");
          // Find all elements with a src attribute:
          const srcContainingElements = htmlDom.querySelectorAll("[src]");

          for (const [i, el] of srcContainingElements.entries()) {
            const src = el.getAttr("src");
            if (
              this.settings.srcAttributeCopyRegex &&
              new RegExp(this.settings.srcAttributeCopyRegex).test(src)
            ) {
              let dataBlob: Blob;
              // If src starts with 'file://', we won't be able to get it using
              // fetch(), as it's on the local filesystem. In that case, we'll
              // need to use Obsidian's Node fs adapter:

              if (src.startsWith("app://obsidian.md")) {
                // We're dealing with a relative src path, which then got
                // prepended with app://obsidian.md. Thus, we won't be able
                // to handle it:
                // urlForDownloading = src.replace(
                //   /^app:\/\/obsidian.md/,
                //   // @ts-ignore
                //   this.app.vault.adapter.basePath
                // );

                continue;
              }

              const srcIsLocalFile = src.startsWith("file://"); // ||
              // src.startsWith("app://obsidian.md") ||

              // We want to avoid CORS errors from downloading from localhost,
              // and so will use the readLocalFile() method for any local
              // file:
              // !new RegExp("^([a-zA-Z])+://").test(src);
              if (srcIsLocalFile) {
                let urlForDownloading = src;

                if (src.startsWith("file:///")) {
                  urlForDownloading = src.replace(/^file:\/\/\//, "");
                }

                dataBlob = new Blob([
                  await FileSystemAdapter.readLocalFile(urlForDownloading),
                ]);

              } else {
                await fetch(src, {})
                  .then(async (response) => await response.blob())
                  .then(async (blob) => {
                    dataBlob = blob;
                  });
              }

              if (dataBlob) {
                const fileName = await createImageFileName(
                  filesTargetLocation,
                  src.split(".")[src.split(".").length - 1]
                );
                const tfileObject = await createTFileObject(
                  fileName,
                  await getBlobArrayBuffer(dataBlob),
                  this.app
                );

                // const dataURL: string = await new Promise((resolve, reject) => {
                //   const urlReader = new FileReader();
                //   urlReader.readAsDataURL(dataBlob);
                //   urlReader.onload = () => {
                //     const b64 = urlReader.result;
                //     resolve(b64.toString());
                //   };
                // });

                srcContainingElements[i].setAttr(
                  "src",
                  encodeURI(tfileObject.path)
                );
              }
            }
          }

          clipboardContents = htmlToMarkdown(htmlDom.documentElement.innerHTML);

          // htmlToMarkdown() will return a blank string if
          // there is no HTML to convert. If that is the case,
          // we will switch to the equivalent Text mode:
          if (clipboardContents === "") {
            if (mode === Mode.Markdown) {
              mode = Mode.Text;
            }
            if (mode === Mode.MarkdownBlockquote) {
              mode = Mode.TextBlockquote;
            }
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
          .match(new RegExp(`^(\\s*)(.*)?`));
        const leadingWhitespace =
          leadingWhitespaceMatch !== null ? leadingWhitespaceMatch[1] : "";

        // The length of `- ` / `* `, to accomodate a bullet list:
        const additionalLeadingWhitespace =
          leadingWhitespaceMatch !== null &&
            leadingWhitespaceMatch[2] !== undefined
            ? " ".repeat(
              leadingWhitespaceMatch[2].length > 3
                ? 3
                : leadingWhitespaceMatch[2].length
            )
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

          // We reverse images here in order that string
          // changes not affect the accuracy of later images'
          // indexes:
          for (let image of images.reverse()) {
            const imageFileName = await createImageFileName(
              filesTargetLocation,
              image.groups.extension
            );

            if (!(await app.vault.adapter.exists(filesTargetLocation))) {
              await app.vault.createFolder(filesTargetLocation);
            }

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

        let input = [
          ...(clipboardContents.split("\n").join("") !== ""
            ? clipboardContents.split("\n")
            : []),
          ...fileLinks,
        ].map((line, i) => {
          if (i === 0) {
            return line;
          }

          return leadingWhitespace + additionalLeadingWhitespace + line;
        });

        if (mode === Mode.Text || mode === Mode.Markdown) {
          output = output + input.join("\n");
        }

        if (mode === Mode.CodeBlock) {
          output = `\`\`\`\n${leadingWhitespace}${input.join(
            "\n"
          )}\n${leadingWhitespace}\`\`\``;
        }

        if (mode === Mode.CodeBlockBlockquote) {
          input = [
            "```",
            leadingWhitespace + input[0],
            ...input.slice(1),
            leadingWhitespace + "```",
          ];
        }

        if (
          mode === Mode.TextBlockquote ||
          mode === Mode.MarkdownBlockquote ||
          mode === Mode.CodeBlockBlockquote
        ) {
          const toggledText = await toggleQuote(
            // We will remove leadingWhitespace from line 0 at the end.
            // It's just here to calculate overall leading whitespace.
            [leadingWhitespace + input[0], ...input.slice(1)],
            this.settings.blockquotePrefix
          );
          toggledText.lines[0] = toggledText.lines[0].replace(
            new RegExp(`^${leadingWhitespace}`),
            ""
          );

          output = toggledText.lines.join("\n");

          if (this.settings.escapeCharactersInBlockquotes) {
            const charactersToEscape = [
              ...output.matchAll(
                new RegExp(this.settings.blockquoteEscapeCharactersRegex, "g")
              ),
            ]
              .map((x) => x.index)
              .reverse();

            charactersToEscape.forEach((index) => {
              if (
                output[Number(index) - 1] !== "\\" &&
                !(
                  output[Number(index) - 1] === "\\" &&
                  output[Number(index) - 2] === "\\"
                )
              ) {
                output =
                  output.substring(0, index) + "\\" + output.substring(index);
              }
            });
          }
        }

        const transaction: EditorTransaction = {
          replaceSelection: output,
        };

        editor.transaction(transaction);
      }
    );

    Object.values(Mode).forEach((value, index) => {
      const key = Object.keys(Mode)[index];
      this.addCommand({
        id: `set-paste-mode-${key}`,
        icon: `pasteIcons-${key}`,
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

    Object.values(Mode).forEach((value, index) => {
      // Passthrough seems not to work with this approach -- perhaps
      // because event.isTrusted can't be set to true? (I'm unsure.)
      if (value !== Mode.Passthrough) {
        if (
          (value !== Mode.Markdown && value !== Mode.MarkdownBlockquote) ||
          this.clipboardReadWorks === true
        ) {
          const key = Object.keys(Mode)[index];

          this.addCommand({
            id: `paste-in-mode-${key}`,
            icon: `pasteIcons-${key}-hourglass`,
            name: `Paste in ${value} Mode`,
            editorCallback: async (editor: Editor, view: MarkdownView) => {
              await pasteInMode(value, editor, view);
            },
          });
        }
      }
    });

    Object.values(Mode).forEach((value) => {
      this.addCommand({
        id: `cycle-paste-mode`,
        icon: `pasteIcons-clipboard-cycle`,
        name: `Cycle Paste Mode`,
        callback: async () => {
          const nextMode = (): Mode => {
            const currentMode = this.settings.mode;
            const modeValues = Object.values(Mode);
            let newMode;
            modeValues.forEach((value, index) => {
              if (value === currentMode) {
                if (index === modeValues.length - 1) {
                  newMode = modeValues[0];
                  return newMode;
                }
                newMode = modeValues[index + 1];
                return newMode;
              }
            });
            return newMode;
          };

          const newPasteMode = nextMode();

          await changePasteMode(newPasteMode);
          new Notice(`Paste mode changed to ${newPasteMode}`);
        },
      });
    });

    this.addCommand({
      id: "toggle-blockquote-at-current-indentation",
      name: "Toggle blockquote at current indentation",
      icon: "pasteIcons-quote-text",
      checkCallback: (checking: boolean) => {
        let view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          if (!checking && view instanceof MarkdownView) {
            toggleQuoteInEditor(view, this.settings.blockquotePrefix);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "set-paste-mode",
      icon: "pasteIcons-clipboard-question",
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
      icon: "pasteIcons-clipboard-question",
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
        .addClass("paste-to-current-indentation-settings-notice");
      noticeDiv
        .createEl("span", {
          text: `The "Paste in Markdown Mode" and "Paste in Markdown (Blockquote) Mode" attachmentOverrideLocations have been disabled, because reading non-text data from the clipboad does not work with this version of Obsidian.`,
        })
        .addClass("paste-to-current-indentation-settings-notice-text");
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
          .setValue(this.plugin.settings.mode || DEFAULT_SETTINGS.mode)
          .onChange(async (value) => {
            this.plugin.settings.mode =
              (value as Mode) || DEFAULT_SETTINGS.mode;
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
          .setValue(
            this.plugin.settings.saveBase64EncodedFiles ||
            DEFAULT_SETTINGS.saveBase64EncodedFiles
          )
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
      .setName("Escape characters in blockquotes")
      .setDesc(
        `When pasting in Text (Blockquote), Code Block (Blockquote), or Markdown (Blockquote) mode, add a backslash escape character to the beginning of specific characters.`
      )
      .addToggle((toggle) => {
        toggle
          .setValue(
            this.plugin.settings.escapeCharactersInBlockquotes ||
            DEFAULT_SETTINGS.escapeCharactersInBlockquotes
          )
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
      .setName("src attribute copy regex")
      .setDesc(
        `If set, when pasting in Markdown or Markdown (Blockquote) mode, watch for any HTML elements that contain a src attribute. If the src value matches this Regular Expression, copy the file being referenced into the Obsidian vault, and replace the src attribute with a reference to that now-local copy of the file.`
      )
      .setDisabled(!this.plugin.settings.escapeCharactersInBlockquotes)
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
        `When saving files from the clipboard, place them in this folder.`
      )
      .addText((text) => {
        text
          .setValue(
            this.plugin.settings.saveFilesLocation ||
            DEFAULT_SETTINGS.saveFilesLocation
          )
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
        .setDesc("...Save a pasted file into this directory:")
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
            .setClass("paste-to-current-indentation-settings-delete-button")
            .setTooltip("Delete override location")
            .onClick(async () => {
              if (attachmentLocationDeletePrimerTimer) {
                clearTimeout(attachmentLocationDeletePrimerTimer);
              }
              if (deleteAttachmentLocationPrimed === true) {
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
