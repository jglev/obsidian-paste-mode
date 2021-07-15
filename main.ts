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

	async pasteText(view: MarkdownView, prepend: string = '') {
		const clipboardText = await navigator.clipboard.readText();
		if (clipboardText !== '') {
			console.log(95, clipboardText);
			const currentCursor = view.sourceMode.editor.getCursor();
			const currentLineText = view.sourceMode.editor.getLine(currentCursor.line);
			const leadingWhitespace = currentLineText.match(/^(\s*).*/)[1];
			console.log(97, leadingWhitespace);
			const clipboardTextIndented = clipboardText.replaceAll(
				/\n/g, '\n' + leadingWhitespace + prepend);
			console.log(102, clipboardTextIndented);
			const replacementText = prepend + 
					clipboardTextIndented;
			view.sourceMode.editor.replaceSelection(
				replacementText,
				'start'
			);

			return;
		}

		new Notice('The clipboard is currently empty.');
	}

	async toggleQuote(view: MarkdownView, prepend: string = quoteMarker) {
		const escapedPrepend = escapeRegExp(prepend);
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

		// Determine whether *every* line is prepended or not. If not, we will
		// add the prepend to every line; if so, we will remove it from every line.
		const isEveryLinePrepended = fullSelectedLines.every(
			(e: string) => {
				const prependMatch = e.match(
					new RegExp(`^\\s{${minLeadingWhitespaceLength}}${escapedPrepend}`)
				);
				if (prependMatch !== null) {
					return true;
				}
				return false;
			}
		);

		// Update the text in-place:
		for (const [i, text] of fullSelectedLines.entries()) {
			if (isEveryLinePrepended === true) {
				fullSelectedLines[i] = text.replace(
					new RegExp(`^(\\s{${minLeadingWhitespaceLength}})${escapedPrepend}`),
					'$1'
					)
			} else {
				// If the prepend is already in the correct place, do not add to it:
				if (!text.match(
					new RegExp(`^\\s{${minLeadingWhitespaceLength}}${escapedPrepend}`)
				)) {
					fullSelectedLines[i] = text.replace(
						new RegExp(`^(\\s{${minLeadingWhitespaceLength}})`),
						`$1${prepend}`
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

		return

		// 	if (text.match(
		// 		new RegExp(
		// 			`^(\\s{${minLeadingWhitespaceLength}})(${escapedPrepend})`)
		// 	)) {
		// 		// There is not a prepend instance at the correct position, so we'll
		// 		// add one:
		// 		return text.replace(
		// 			new RegExp(`^(\\s{${minLeadingWhitespaceLength}})`),
		// 			`$1${prepend}`
		// 		)
		// 	}

		// 	// There IS a prepend instance at the correct position, so we'll remove
		// 	// it:
		// 	return text.replace(
		// 		new RegExp(`^(\\s{0,${minLeadingWhitespaceLength}})${escapedPrepend}`),
		// 		`$1`
		// 	)

		// return
		
		// const currentLineText = view.sourceMode.editor.getLine(
		// 	currentSelectionStart.line
		// );
		// console.log(158, currentLineText);

		// let minLeadingWhitespaceLength = currentLineText.match(/^\s*/)[0].length;

		// // If we have a multi-line selection:
		// if (currentSelectionStart.line !== currentSelectionEnd.line) {
		// 	const currentSelection = view.sourceMode.editor.getSelection();
		// 	let leadingWhitespaces = [];
		// 	const selectionLeadingWhitespace = currentLineText.match(/^\n*\s*/);
		// 	if (selectionLeadingWhitespace !== null) {
		// 		leadingWhitespaces.push(selectionLeadingWhitespace[0]);
		// 	} else {
		// 		leadingWhitespaces.push('');
		// 	}
		// 	leadingWhitespaces = [
		// 		...leadingWhitespaces,
		// 		...[...currentSelection.matchAll(/\n(\s*)/g)].map(
		// 			(e: Array<string>) => e[1]
		// 		)
		// 	]

		// 	minLeadingWhitespaceLength = Math.min.apply(
		// 		null,
		// 		leadingWhitespaces.map((e: Array<string>) => e.length)
		// 	);

		// 	console.log(182, leadingWhitespaces, minLeadingWhitespaceLength);
			
		// 	const toggledSelection = currentSelection.replaceAll(
		// 		new RegExp(
		// 			`\n(\\s{0,${minLeadingWhitespaceLength}})(\\s*)(.*)`, 'g'), (
		// 			match: string,
		// 			p1: string,
		// 			p2: string,
		// 			p3: string
		// 		) => {
		// 			console.log(161, match, p1, p2, p3);
		// 			if (p2 === '' && p3.startsWith(prepend.trimStart())) {
		// 				console.log(171);
		// 				return '\n' + p1 + p2 + p3.replace(prepend, '');
		// 			}
		// 			console.log(174);
		// 			return '\n' 
		// 				// Account for use of spaces OR tabs, vs. just statically using 
		// 				// one or the other:
		// 				+ p1
		// 				+ prepend 
		// 				+ p2
		// 				+ p3;
		// 		}
		// 	);
			
		// 	view.sourceMode.editor.replaceSelection(
		// 		toggledSelection,
		// 		'start'
		// 	);
		// }

		// if (currentLineText
		// 	.match(/^\n*(\s*)(.*)/)[2]
		// 	.startsWith(prepend.trimStart())
		// ) {
		// 	// If there is already a quote marker at the start of the line,
		// 	// remove it:
		// 	console.log(184);
		// 	view.sourceMode.editor.setLine(
		// 		currentSelectionStart.line,
		// 		currentLineText.replace(prepend, '' )
		// 	);
		// } else {
		// 	// If there not already a quote marker at the start of the line,
		// 	// add it:
		// 	console.log(190);
		// 	view.sourceMode.editor.setLine(
		// 		currentSelectionStart.line,
		// 		currentLineText.replace(
		// 			new RegExp(`(\\s{0,${minLeadingWhitespaceLength}})`),
		// 			'$1' 
		// 			+ prepend
		// 		)
		// 	);
		// }
	}

	// onunload() {
	// 	console.log('unloading plugin');
	// }

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
