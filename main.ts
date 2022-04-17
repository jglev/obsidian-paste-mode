import {
  addIcon,
  App,
  Editor,
  EditorTransaction,
  FuzzySuggestModal,
  htmlToMarkdown,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
} from "obsidian";

import { toggleQuote, toggleQuoteInEditor } from "./src/toggle-quote";

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

class PasteModeModal extends FuzzySuggestModal<number> {
  public readonly onChooseItem: (item: number) => void;
  public readonly currentValue: Mode;
  public readonly showCurrentValue: boolean;

  constructor({
    app,
    onChooseItem,
    currentValue,
    showCurrentValue,
  }: {
    app: App;
    onChooseItem: (patternIndex: number) => void;
    currentValue: Mode;
    showCurrentValue: boolean;
  }) {
    super(app);

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
    return Object.keys(Mode).map((key, index) => index);
  }

  getItemText(index: number): string {
    return Object.values(Mode)[index];
  }
}

interface PastetoIndentationPluginSettings {
  blockquotePrefix: string;
  mode: Mode;
  apiVersion: number;
}

const DEFAULT_SETTINGS: PastetoIndentationPluginSettings = {
  blockquotePrefix: "> ",
  mode: Mode.Markdown,
  apiVersion: 2,
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

    this.clipboardReadWorks = false;
    try {
      await navigator.clipboard.read();
      this.clipboardReadWorks = true;
    } catch (error) {
      console.log(
        "Reading non-text data from the clipboard does not work with this version of Obsidian. Disabling the paste-in-mode commands for Markdown and Markdown (Blockquote) modes."
      );
    }

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
        if (evt.clipboardData.types.every((type) => type === "files")) {
          return;
        }

        let mode = this.settings.mode;

        if (mode === Mode.Passthrough) {
          return;
        }

        evt.preventDefault();

        let clipboardContents = "";
        let output = "";

        if (mode === Mode.Markdown || mode === Mode.MarkdownBlockquote) {
          clipboardContents = htmlToMarkdown(
            evt.clipboardData.getData("text/html")
          );
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

        let input = clipboardContents.split("\n").map((line, i) => {
          if (i === 0) {
            return line;
          }
          return leadingWhitespace + line;
        });

        if (mode === Mode.Text || mode === Mode.Markdown) {
          output = input.join("\n");
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
      if (this.clipboardReadWorks) {
        // const permission = await navigator.permissions.query({
        //   // Using 'as PermissionName' is a workaround from
        //   // https://github.com/microsoft/TypeScript/issues/33923#issuecomment-743062954
        //   name: "clipboard-read" as PermissionName,
        // });
        // if (permission.state === "denied") {
        //   throw new Error("Not allowed to read clipboard.");
        // }
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
          transfer.setData(await navigator.clipboard.readText(), "text/plain");
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
      }
    };

    Object.values(Mode).forEach((value, index) => {
      // Passthrough seems not to work with this approach -- perhaps
      // because event.isTrusted can't be set to true? (I'm unsure.)
      if (value !== Mode.Passthrough) {
        if (
          (value !== Mode.Markdown && value === Mode.MarkdownBlockquote) ||
          this.clipboardReadWorks
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
        } else {
          const key = Object.keys(Mode)[index];

          this.addCommand({
            id: `paste-in-mode-${key}`,
            icon: `pasteIcons-${key}-hourglass`,
            name: `Paste in ${value} Mode`,
            editorCallback: async () => {
              new Notice(
                `The "Paste in ${value} Mode" command is disabled on this platform because reading non-text data from the clipboard is not possible.`
              );
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
        });
        newMode.open();
      },
    });

    this.addCommand({
      id: "paste-in-mode-interactive",
      icon: "pasteIcons-clipboard-question",
      name: "Paste in mode (Interactive)",
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        const newMode = new PasteModeModal({
          app,
          onChooseItem: async (item: number): Promise<void> => {
            const selection = Object.values(Mode)[item];
            await pasteInMode(selection, editor, view);
          },
          currentValue: null,
          showCurrentValue: false,
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
