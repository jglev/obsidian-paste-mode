import {
  addIcon,
  App,
  base64ToArrayBuffer,
  Editor,
  EditorTransaction,
  FuzzySuggestModal,
  htmlToMarkdown,
  MarkdownView,
  Notice,
  Platform,
  Plugin,
  PluginSettingTab,
  TFile,
  Setting,
} from "obsidian";

import { toggleQuote, toggleQuoteInEditor } from "./src/toggle-quote";

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
    imageFileNameWithIndex = `${
      fileLocation || "."
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

interface PastetoIndentationPluginSettings {
  blockquotePrefix: string;
  mode: Mode;
  saveBase64EncodedFiles: boolean;
  saveFilesLocation: string;
  apiVersion: number;
}

const DEFAULT_SETTINGS: PastetoIndentationPluginSettings = {
  blockquotePrefix: "> ",
  mode: Mode.Markdown,
  saveBase64EncodedFiles: false,
  saveFilesLocation: "",
  apiVersion: 3,
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

        let mode = this.settings.mode;

        if (mode === Mode.Passthrough) {
          return;
        }

        evt.preventDefault();

        let clipboardContents = "";
        let output = "";

        // TODO: Add setting here.
        // if (evt.clipboardData.types.every((type) => type === "files")) {
        //   return;
        // }
        const files = evt.clipboardData.files;
        const fileLinks = [];
        if (files.length) {
          if (
            !(await app.vault.adapter.exists(this.settings.saveFilesLocation))
          ) {
            await app.vault.createFolder(this.settings.saveFilesLocation);
          }
        }

        for (var i = 0; i < files.length; i++) {
          const fileObject = files[i];

          const fileName = await createImageFileName(
            this.settings.saveFilesLocation,
            fileObject.type.split("/")[1]
          );

          await app.vault.adapter.writeBinary(
            fileName,
            await fileObject.arrayBuffer()
          );

          const tfileObject = this.app.vault.getFiles().filter((f) => {
            return f.path === fileName;
          })[0];

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
          const clipboardHtml = evt.clipboardData.getData("text/html");
          clipboardContents = htmlToMarkdown(clipboardHtml);
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
          .match(new RegExp(`^(\\s*)`));
        const leadingWhitespace =
          leadingWhitespaceMatch !== null ? leadingWhitespaceMatch[1] : "";

        if (
          this.settings.saveBase64EncodedFiles &&
          mode !== Mode.CodeBlock &&
          mode !== Mode.CodeBlockBlockquote
        ) {
          const images = [
            ...clipboardContents.matchAll(
              /data:image\/(?<extension>.*?);base64,\s*(?<data>.*)\b/g
            ),
          ];

          // We reverse images here in order that string
          // changes not affect the accuracy of later images'
          // indexes:
          for (let image of images.reverse()) {
            const imageFileName = await createImageFileName(
              this.settings.saveFilesLocation,
              image.groups.extension
            );

            if (
              !(await app.vault.adapter.exists(this.settings.saveFilesLocation))
            ) {
              await app.vault.createFolder(this.settings.saveFilesLocation);
            }

            await app.vault.adapter.writeBinary(
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
          return leadingWhitespace + line;
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

    containerEl.createEl("h2", { text: "Paste to Current Indentation" });

    if (!this.plugin.clipboardReadWorks) {
      const noticeDiv = containerEl.createDiv();
      noticeDiv
        .createEl("span", { text: "Notice: " })
        .addClass("paste-to-current-indentation-settings-notice");
      noticeDiv
        .createEl("span", {
          text: `The "Paste in Markdown Mode" and "Paste in Markdown (Blockquote) Mode" commands have been disabled, because reading non-text data from the clipboad does not work with this version of Obsidian.`,
        })
        .addClass("paste-to-current-indentation-settings-notice-text");
    }

    new Setting(containerEl)
      .setName("Paste Mode")
      .setDesc("Mode that the paste command will invoke.")
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
      .setName("base64-encoded file location")
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
  }
}
