import { App, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

const quoteMarker = '> '

// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping,
// which, as a code snippet, is in the public domain, per 
// https://developer.mozilla.org/en-US/docs/MDN/About#copyrights_and_licenses
// (as of 2021-07-15):
function escapeRegExp(string: string) {
	// $& means the whole matched string:
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		console.log('Loading paste-to-current-indentation');

		await this.loadSettings();

		// this.addRibbonIcon('dice', 'Sample Plugin', () => {
		// 	new Notice('This is a notice!');
		// });

		// this.addStatusBarItem().setText('Status Bar Text');

		// this.addCommand({
		// 	id: 'open-sample-modal',
		// 	name: 'Open Sample Modal',
		// 	// callback: () => {
		// 	// 	console.log('Simple Callback');
		// 	// },
		// 	checkCallback: (checking: boolean) => {
		// 		let leaf = this.app.workspace.activeLeaf;
		// 		if (leaf) {
		// 			if (!checking) {
		// 				new SampleModal(this.app).open();
		// 			}
		// 			return true;
		// 		}
		// 		return false;
		// 	}
		// });

		this.addCommand({
			id: 'paste-text-to-current-indentation',
			name: 'Paste text to current indentation',
			checkCallback: (checking: boolean) => {
				let view = this.app.workspace.activeLeaf.view;
				if (view) {
					if (!checking) {
						if (view instanceof MarkdownView) {
							this.pasteText(view);
						}
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'paste-blockquote-to-current-indentation',
			name: 'Paste blockquote to current indentation',
			checkCallback: (checking: boolean) => {
				let view = this.app.workspace.activeLeaf.view;
				if (view) {
					if (!checking && view instanceof MarkdownView) {
						console.log('Pasting quote...');
						this.pasteText(view, quoteMarker);
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'toggle-blockquote-at-current-indentation',
			name: 'Toggle blockquote at current indentation',
			checkCallback: (checking: boolean) => {
				let view = this.app.workspace.activeLeaf.view;
				if (view) {
					if (!checking && view instanceof MarkdownView) {
						console.log('Toggling quote...');
						this.toggleQuote(view, quoteMarker);
					}
					return true;
				}
				return false;
			}
		});

		// this.addCommand({
		// 	id: 'paste-blockquote-to-current-indentation',
		// 	name: 'Paste blockquote to current indentation',
		// 	// callback: () => {
		// 	// 	console.log('Simple Callback');
		// 	// },
		// 	checkCallback: (checking: boolean) => {
		// 		let leaf = this.app.workspace.activeLeaf;
		// 		if (leaf) {
		// 			if (!checking) {
		// 				new SampleModal(this.app).open();
		// 			}
		// 			return true;
		// 		}
		// 		return false;
		// 	}
		// });

		// this.addSettingTab(new SampleSettingTab(this.app, this));

		// this.registerCodeMirror(async (cm: CodeMirror.Editor) => {
		// 	console.log('codemirror', cm);
		// 	console.log('Permissions:', navigator.permissions);
		// 	var clipboardText = await navigator.clipboard
		// 	console.log('Text:', clipboardText);
		// });

		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	console.log('click', evt);
		// });

		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	async pasteText(view: MarkdownView, prefix: string = '') {
		const clipboardText = await navigator.clipboard.readText();
		if (clipboardText !== '') {
			console.log(95, clipboardText);
			const currentCursor = view.sourceMode.editor.getCursor();
			const currentLineText = view.sourceMode.editor.getLine(currentCursor.line);
			const leadingWhitespace = currentLineText.match(/^(\s*).*/)[1];
			console.log(97, leadingWhitespace);
			const clipboardTextIndented = clipboardText.replaceAll(
				/\n/g, '\n' + leadingWhitespace + prefix);
			console.log(102, clipboardTextIndented);
			const replacementText = prefix + 
					clipboardTextIndented;
			view.sourceMode.editor.replaceSelection(
				replacementText,
				'start'
			);

			return;
		}

		new Notice('The clipboard is currently empty.');
	}

	async toggleQuote(view: MarkdownView, prefix: string = quoteMarker) {
		const escapedPrefix = escapeRegExp(prefix);
		const currentSelectionStart = view.sourceMode.editor.getCursor('from');
		const currentSelectionEnd = view.sourceMode.editor.getCursor('end');
		console.log(
			155, 
			currentSelectionStart, 
			currentSelectionEnd, 
			view.sourceMode.editor.getLine(currentSelectionEnd.line)
		);
		
		const replacementRange = [
			{line: currentSelectionStart.line, ch: 0},
			{
				line: currentSelectionEnd.line,
				ch: view.sourceMode.editor.getLine(currentSelectionEnd.line).length
			}
		]

		const fullSelectedLines = view.sourceMode.editor.getRange(
			replacementRange[0],
			replacementRange[1]
		).split('\n');

		console.log(165, fullSelectedLines);

		const leadingWhitespaces = fullSelectedLines.map(
			(e: string) => {
				const whitespaceMatch = e.match(new RegExp(`^(\\s*)`));
				return whitespaceMatch !== null ? whitespaceMatch[1] : '';
			}
		);
		const minLeadingWhitespaceLength = Math.min(
			...leadingWhitespaces.map((e: string) => e.length)
		);

		console.log(192, leadingWhitespaces, minLeadingWhitespaceLength);
		console.log(198, fullSelectedLines);

		// Determine whether *every* line is Prefixed or not. If not, we will
		// add the prefix to every line; if so, we will remove it from every line.
		const isEveryLinePrefixed = fullSelectedLines.every(
			(e: string) => {
				const prefixMatch = e.match(
					new RegExp(`^\\s{${minLeadingWhitespaceLength}}${escapedPrefix}`)
				);
				if (prefixMatch !== null) {
					return true;
				}
				return false;
			}
		);

		// Update the text in-place:
		for (const [i, text] of fullSelectedLines.entries()) {
			if (isEveryLinePrefixed === true) {
				fullSelectedLines[i] = text.replace(
					new RegExp(`^(\\s{${minLeadingWhitespaceLength}})${escapedPrefix}`),
					'$1'
					)
			} else {
				// If the prefix is already in the correct place, do not add to it:
				if (!text.match(
					new RegExp(`^\\s{${minLeadingWhitespaceLength}}${escapedPrefix}`)
				)) {
					fullSelectedLines[i] = text.replace(
						new RegExp(`^(\\s{${minLeadingWhitespaceLength}})`),
						`$1${prefix}`
					)
				}
			}
		}

		console.log(225, fullSelectedLines);

		view.sourceMode.editor.replaceRange(
			fullSelectedLines.join('\n'),
			replacementRange[0],
			replacementRange[1]
		);

		view.sourceMode.cmEditor.setSelection(
			{
				line: currentSelectionStart.line,
				ch: isEveryLinePrefixed ? 
					currentSelectionStart.ch - prefix.length: 
					currentSelectionStart.ch + prefix.length
			},
			{
				line: currentSelectionEnd.line,
				ch: isEveryLinePrefixed ? 
					currentSelectionEnd.ch - prefix.length: 
					currentSelectionEnd.ch + prefix.length
			},
			{
				origin: '+input'
			}
		);

		return
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		let {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue('')
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
