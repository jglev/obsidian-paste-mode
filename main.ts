import {
  App,
  Editor,
  EditorChange,
  EditorRangeOrCaret,
  EditorTransaction,
  FuzzySuggestModal,
  htmlToMarkdown,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  Workspace,
} from "obsidian";

import { toggleQuote, toggleQuoteInEditor } from "./src/toggle-quote";
import { pasteText } from "./src/paste-text";
import { pasteHTMLBlockquoteText } from "./src/paste-html-blockquote-text";

enum Mode {
  Text = "text",
  TextBlockquote = "text-blockquote",
  Markdown = "markdown",
  MarkdownBlockquote = "markdown-blockquote",
  Passthrough = "passthrough",
}

class PasteModeModal extends FuzzySuggestModal<number> {
  public readonly onChooseItem: (item: number) => void;

  constructor({
    app,
    onChooseItem,
  }: {
    app: App;
    onChooseItem: (patternIndex: number) => void;
  }) {
    super(app);

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
}

const DEFAULT_SETTINGS: PastetoIndentationPluginSettings = {
  blockquotePrefix: "> ",
  mode: Mode.Markdown,
};

export default class PastetoIndentationPlugin extends Plugin {
  settings: PastetoIndentationPluginSettings;
  statusBar: HTMLElement;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new SettingTab(this.app, this));

    this.app.workspace.on(
      "editor-paste",
      async (
        evt: ClipboardEvent,
        editor: Editor,
        markdownView: MarkdownView
      ) => {
        // Per https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts#L3690,
        // "Check for `evt.defaultPrevented` before attempting to handle this
        // event, and return if it has been already handled."
        if (evt.defaultPrevented) {
          return;
        }
        if (evt.clipboardData.types.every((type) => type === "files")) {
          return;
        }

        const mode = this.settings.mode;

        if (mode === Mode.Passthrough) {
          return;
        }

        evt.preventDefault();

        let output = "";

        if (mode === Mode.Markdown || mode === Mode.MarkdownBlockquote) {
          output = htmlToMarkdown(evt.clipboardData.getData("text/html"));
          if (output === "") {
            output = evt.clipboardData.getData("text");
          }
          if (mode === Mode.MarkdownBlockquote) {
            const toggledText = await toggleQuote(
              output.split("\n"),
              this.settings.blockquotePrefix
            );
            output = toggledText.lines.join("\n");
          }
        }

        if (mode === Mode.Text || mode === Mode.TextBlockquote) {
          output = htmlToMarkdown(evt.clipboardData.getData("text"));

          if (mode === Mode.TextBlockquote) {
            const toggledText = await toggleQuote(
              output.split("\n"),
              this.settings.blockquotePrefix
            );
            output = toggledText.lines.join("\n");
          }
        }

        console.log(132, editor.getCursor());

        const cursorFrom = editor.getCursor("from");
        const cursorTo = editor.getCursor("to");

        let transactionChange: EditorChange = {
          from: cursorFrom,
          text: output,
        };

        if (
          cursorFrom.line === cursorTo.line &&
          cursorFrom.ch === cursorTo.ch
        ) {
          transactionChange = { ...transactionChange, to: cursorTo };
        }

        const transaction: EditorTransaction = {
          changes: [transactionChange],
        };

        editor.transaction(transaction);

        // console.log(35, evt, editor, markdownView);
        // console.log(52, evt.clipboardData.getData("text"));
        // console.log(53, evt.clipboardData.getData("text/html"));
      }
    );

    Object.values(Mode).forEach((value) => {
      this.addCommand({
        id: `past-mode-${value}`,
        name: `Set Paste Mode to ${value}`,
        callback: async () => {
          this.settings.mode = value;
          await this.saveSettings();
          this.statusBar.setText(`Paste Mode: ${value}`);
        },
      });
    });

    this.addCommand({
      id: "paste-text-to-current-indentation",
      name: "Paste text to current indentation",
      checkCallback: (checking: boolean) => {
        let view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          if (!checking) {
            pasteText(view);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "paste-blockquote-to-current-indentation",
      name: "Paste blockquote to current indentation",
      checkCallback: (checking: boolean) => {
        let view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          if (!checking && view instanceof MarkdownView) {
            pasteText(view, this.settings.blockquotePrefix);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "paste-html-wrapped-blockquote",
      name: "Paste HTML-wrapped blockquote to current indentation",
      checkCallback: (checking: boolean) => {
        let view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          if (!checking && view instanceof MarkdownView) {
            pasteHTMLBlockquoteText(view);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "toggle-blockquote-at-current-indentation",
      name: "Toggle blockquote at current indentation",
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

    this.statusBar = this.addStatusBarItem();
    this.statusBar.setText(`Paste Mode: ${this.settings.mode}`);
    const onChooseItem = async (item: number): Promise<void> => {
      const selection = Object.values(Mode)[item];
      this.settings.mode = selection;
      await this.saveSettings();
      this.statusBar.setText(`Paste Mode: ${selection}`);
    };
    const app = this.app;
    this.statusBar.onClickEvent(() => {
      const newMode = new PasteModeModal({ app, onChooseItem });
      newMode.open();
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
            this.plugin.statusBar.setText(`Paste Mode: ${this.plugin.settings.mode}`);
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
