import { appLocalDataDir } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';

import { Editor, ChangeEvent } from './vendor/tiny-mde-0.2.15/TinyMDE';
import { CommandBar } from './vendor/tiny-mde-0.2.15/TinyMDECommandBar';
import { MarkdownParser } from './markdown-parser';
import { NoteManager } from './note-manager';
import { NoteUtils } from './note-utils';
import Notifier from 'notifier-ts';
import { Entry } from './entry';

export class UIManager {
	private noteTabsContainer: HTMLDivElement;
	private entriesContainer: HTMLDivElement;
	private logInput: HTMLTextAreaElement;
	private activeQuotePreview: HTMLDivElement;
	private activeQuotedEntryIndex: number | null = null;
	
	// private persistentTextInput: HTMLDivElement;
	// private persistentTextEditor: HTMLTextAreaElement;
	private tinyMDE: Editor;

	private overviewDateSelector: HTMLInputElement;
	private overviewDateRangeSelector: HTMLInputElement;
	private entryPopupMenu: HTMLDivElement;
	private isPopupMenuActive: boolean = false;
	private renderEntryMarkdown: boolean = true;

	private willDeleteNote: boolean = false;
	private highlightedEntryID: number | null = null;
	private currentlyEditedEntryID: null | number = null;
	private currentIndentationLevel: number = 0;
	private draggedTab: HTMLDivElement | null = null; 

	private imageDirectory: string;

	private noteManager: NoteManager;
	private markdownParser: MarkdownParser;

	public constructor() {
		this.noteTabsContainer = document.getElementById('note-tabs') as HTMLDivElement;
		this.entriesContainer = document.getElementById('entry-container') as HTMLDivElement;
		this.logInput = document.getElementById('log-input') as HTMLTextAreaElement;
		this.activeQuotePreview = document.getElementById('active-quote-preview') as HTMLDivElement;
		// this.persistentTextInput = document.getElementById('persistent-text-input') as HTMLDivElement;
		this.overviewDateSelector = document.getElementById('start-date-selector') as HTMLInputElement;
		this.overviewDateRangeSelector = document.getElementById('date-range-selector') as HTMLInputElement;
		this.entryPopupMenu = document.getElementById('popup-menu') as HTMLDivElement;

		this.noteTabsContainer.innerHTML = '';
		this.entriesContainer.innerHTML = '';

		this.noteManager = new NoteManager();
		Notifier.setDefaults({ theme: 'dark', duration: this.noteManager.userSettings.toastDuration });
		this.markdownParser = new MarkdownParser();
		
		// const persistentTextInput = document.getElementById('persistent-text-input') as HTMLDivElement;
		this.tinyMDE = new Editor({
			// editor: persistentTextInput,
			element: document.getElementById('editor-container'),
			customInlineGrammar: {
				// emoji: {
				// 	regexp: /^(:)([a-z_-]+)(:)/,
				// 	replacement: '<span class="TMMark">$1</span><i class="TMEmoji">$2</i><span class="TMMark">$3</span>',
				// },
			},
		});

		this.tinyMDE.e.id = 'persistent-text-input';
		this.tinyMDE.e.dataset.placeholder = 'Permanent note content...'; // FIXME: Never actually makes a difference because TinyMDE initialises with divs alr inside
		// this.tinyMDE.e.classList.add('big-note');

		const _commandBar = new CommandBar({
			element: 'persistent-commandbar',
			editor: this.tinyMDE,
		});

		this.initialiseInput();
	}
	
	public async initialiseAsync(): Promise<void> {
		this.imageDirectory = await appLocalDataDir() + '/images/';

		try {
			await this.noteManager.loadUserSettings();
		} catch (err) {
			Notifier.error('Error loading config file: '+err);
		}

		try {
			await this.noteManager.loadImageData();
		} catch (err) {
			Notifier.error('Error loading image data: '+err);
		}

		let result = [];
		try {
			result = await this.noteManager.loadAllNotes();
			if (result.length > 0) {
				Notifier.success('Loaded all notes from headings file');
			}
		} catch (err) {
			Notifier.error('Error loading notes: '+err);
		}
		try {
			const openNotes = await this.noteManager.restorePreviousSession();

			openNotes.forEach(noteData => {
				this.createNoteTab(noteData.id, noteData.title);
				this.updateSaveStateDisplay(noteData.id);
			})

		} catch (err) {
			Notifier.error('Error loading notes: '+err);
		}
		
		this.setupOverviewDateSelectors();
		const currentNoteID = this.noteManager.getActiveNoteID();
		this.selectNoteTab(currentNoteID);
		this.setCurrentNote(currentNoteID);
	}

	private initialiseInput(): void {
		this.setupPersistentTextHandlers();
		this.setupKeyboardShortcuts();
		this.setupSidebarClickHandler();
		this.setupTabDragging();
		this.setupLogInput();
		this.setupFileInput();
		this.setupEntryInteraction();
	}

	private setupKeyboardShortcuts(): void {
		window.addEventListener('keydown', (e) => {
			if (this.draggedTab) return;
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == 's') {
				e.preventDefault();
				if (e.shiftKey) { // Saves all notes on Ctrl + Shift + S, and just the active one on Ctrl + S
					this.saveAllNotes();
				} else {
					this.saveCurrentNote();
				}
			} else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { // Ctrl + N to make a new note
				e.preventDefault();
				this.addNewNote();
			} else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == 'o') { // Ctrl + O to open a note
				e.preventDefault();
				const unopenedNotes = this.noteManager.getUnopenedNotes();
				if (unopenedNotes.length == 0) {
					Notifier.info('No notes to open!');
				} else {
					Notifier.select('Select note...', unopenedNotes, { isBlocking: true, allowNewOptions: true }).then((noteID) => {
						if (noteID) {
							if (unopenedNotes.includes(noteID)) {
								this.openNote(noteID);
								this.selectNoteTab(noteID);
								this.noteManager.writeToCache();
							} else {
								Notifier.confirm('Create new note with title "'+noteID+'"?', { isBlocking: true }).then((result) => {
									if (result == true) this.addNewNote(noteID);
								});
							}
						}
					});
				}
			} else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == 'w') { // Ctrl + W to close a note
				e.preventDefault();
				this.closeCurrentNote();
			} else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == 'q') { // Ctrl + Q to quick save to cache
				e.preventDefault();
				this.noteManager.writeToCache();
	
			}
			
		});
	}

	private setupPersistentTextHandlers(): void {
		// document.getElementById('right-panel').addEventListener('click', () => {
		// 	this.tinyMDE.e.focus();
		// });

		// this.persistentTextInput.addEventListener('keydown', (e: KeyboardEvent) => {
		// 	if (e.ctrlKey && e.key.toLowerCase() == 'z') {
		// 		this.noteManager.undo();
		// 		this.persistentTextInput.value = this.noteManager.getPersistentText();
		// 		this.persistentTextInput.focus();

		// 		e.preventDefault();
		// 	}
		// 	if (e.ctrlKey && e.key.toLowerCase() == 'y') {
		// 		this.noteManager.redo();
		// 		this.persistentTextInput.value = this.noteManager.getPersistentText();
		// 		this.persistentTextInput.focus();

		// 		e.preventDefault();
		// 	}
		// });

		this.tinyMDE.addEventListener('change', (e: ChangeEvent) => {
			if (this.draggedTab) return;
			const plainText = e.content;
			
			const saveStateChanged = this.noteManager.updatePersistentText(plainText);
			if (saveStateChanged) {
				this.updateSaveStateDisplay();
			}
		});
	}


	private setupSidebarClickHandler(): void {
		const sidebar = document.getElementById('sidebar') as HTMLFormElement;
		sidebar.addEventListener('click', (e) => {
			if (this.draggedTab) return;
			const target = e.target as HTMLElement;
			if (target.className == 'tab-input') {
				this.setCurrentNote(target.id);
			}

		});

		const addNotetab = document.getElementById('add-note-tab') as HTMLDivElement;
		addNotetab.addEventListener('click', (e) => {
			e.preventDefault();
			this.addNewNote();
		});
	}

	private setupTabDragging(): void {
		this.noteTabsContainer.addEventListener('mousedown', (e) => {
			if (e.clientX > this.noteManager.userSettings.dragHandleWidth) return;
			
			const targetTab = (e.target as HTMLElement).closest('.tab') as HTMLDivElement;
			if (!targetTab) return;
			this.draggedTab = targetTab;
			this.draggedTab.classList.add('dragging');

			const deleteNoteElement = document.createElement('div');
			deleteNoteElement.id = 'delete-note-tab';
			deleteNoteElement.classList.add('tab');
			deleteNoteElement.classList.add('tab-label');
			deleteNoteElement.textContent = 'Delete note';
			this.noteTabsContainer.insertBefore(deleteNoteElement,this.noteTabsContainer.firstElementChild); // POSSIBLE ISSUE

			document.body.style.userSelect = 'none';
			document.body.style.webkitUserSelect = 'none';
		});

		window.addEventListener('mouseup', () => {
			if (!this.draggedTab) return;

			const newTabIndex = Array.from(this.noteTabsContainer.children).indexOf(this.draggedTab);
			this.noteManager.reorderOpenNotes(this.draggedTab.querySelector('.tab-input').id, newTabIndex);

			if (this.willDeleteNote) {
				this.willDeleteNote = false;
				this.draggedTab.classList.remove('threatened');
				this.deleteNote(this.draggedTab.querySelector('.tab-input').id);
			}

			const deleteNoteElement = document.getElementById('delete-note-tab');
			deleteNoteElement.remove();
			this.draggedTab.classList.remove('dragging');
			this.draggedTab = null;
			document.body.style.userSelect = '';
			document.body.style.webkitUserSelect = '';
			
		});

		this.noteTabsContainer.addEventListener('mousemove', (e: MouseEvent) => {
			if (!this.draggedTab) return;

			const tabs = Array.from(this.noteTabsContainer.querySelectorAll('.tab')).filter(t => t !== this.draggedTab);
			let inserted = false;

			for (const tab of tabs) {
				const rect = tab.getBoundingClientRect();
				if (e.clientY < rect.top + rect.height / 2) {
					if (tab.id == 'delete-note-tab') {
						if (!this.willDeleteNote) {
							this.willDeleteNote = true;
							this.draggedTab.classList.add('threatened');
						}
						break;
					} else {
						if (this.willDeleteNote) {
							this.willDeleteNote = false;
							this.draggedTab.classList.remove('threatened');
						}
						this.noteTabsContainer.insertBefore(this.draggedTab, tab);
						inserted = true;
						break;
					}
				}
			}

			if (!inserted) this.noteTabsContainer.appendChild(this.draggedTab);
			
		});
	}

	private async deleteNote(noteID: string): Promise<boolean> {
		const result = await confirm('Delete note: '+noteID+'?');
		
		if (result) {
			this.closeNote(noteID);
			if (this.noteManager.deleteNote(noteID)) {
				Notifier.success(`Deleted ${noteID}`);
			}
		} else {
			return false;
		}
	}

	private setupOverviewDateSelectors(): void {
		
		const overviewDateLimits = this.noteManager.overview.getDates();
		const overviewDateCurrent = this.noteManager.overview.getCurrentDateRange();
		this.overviewDateSelector.min = overviewDateLimits.earliest;
		this.overviewDateSelector.max = overviewDateLimits.latest;
		this.overviewDateSelector.value = overviewDateCurrent.start;

		const overviewDayPrev = document.getElementById('day-prev') as HTMLButtonElement;
		const overviewDayNext = document.getElementById('day-next') as HTMLButtonElement;

		this.overviewDateSelector.addEventListener('change', () => {
			const newDate = new Date(this.overviewDateSelector.value);
			this.noteManager.overview.updateSelectedDate(newDate);
			this.refreshOverviewPage();
		});

		this.overviewDateRangeSelector.addEventListener('change', () => {
			const newDateRange = parseInt(this.overviewDateRangeSelector.value);
			this.noteManager.overview.updateSelectedDateRange(newDateRange);
			this.refreshOverviewPage();
		});

		overviewDayPrev.addEventListener('click', () => {
			const newDate = this.noteManager.overview.stepBackward();
			this.overviewDateSelector.value = newDate;
			this.refreshOverviewPage();
		});

		overviewDayNext.addEventListener('click', () => {
			const newDate = this.noteManager.overview.stepForward();
			this.overviewDateSelector.value = newDate;
			this.refreshOverviewPage();
		});
	}

	private async refreshOverviewPage(): Promise<void> {
		this.noteManager.updateOverview();
		const overviewDayPrev = document.getElementById('day-prev') as HTMLButtonElement;
		const overviewDayNext = document.getElementById('day-next') as HTMLButtonElement;
		overviewDayPrev.disabled = this.noteManager.overview.isCurrentDateRangeEarliest();
		overviewDayNext.disabled = this.noteManager.overview.isCurrentDateRangeLatest();
		this.logInput.disabled = !overviewDayNext.disabled;
		this.displayCurrentEntries();
	}

	private setupLogInput(): void {
		const entriesContainer = document.getElementById('entry-container') as HTMLDivElement;

		entriesContainer.addEventListener('click', (e) => {
			const target = e.target as HTMLElement;
			if (target.classList.contains('disclosure-widget')) {
				const parent = target.parentElement;
				if (!parent) return;

				parent.classList.toggle('collapsed');
			}
		});

		this.logInput.addEventListener('input', () => {
			this.updateLogInputHeight();
		});
		this.logInput.addEventListener('keydown', (e) => {
			if (e.keyCode == 9) { // Tab key - because Shift + Tab returns e.key == "Unidentified"
				e.preventDefault();
				const start: number = this.logInput.selectionStart;
				const end: number = this.logInput.selectionEnd;

				const text: string = this.logInput.value;

				if (e.shiftKey) { // Shift + Tab should be outdent/dedent
					const newText: string = NoteUtils.shiftSelectedText(text, start, end, -1);
					this.logInput.value = newText;
					this.currentIndentationLevel--;
				} else if (this.currentIndentationLevel < 30) { // Binary serialisation format can only store up to 31 indentations
					const newText: string = NoteUtils.shiftSelectedText(text, start, end, 1);
					this.logInput.value = newText;
					this.currentIndentationLevel++;
				}

			} else if (e.key == 'Enter') {
				e.preventDefault();
				if (e.shiftKey) {
					this.submitEntry();
				} else {
					this.insertNewLine();
				}
			}
		});

		const submitEntryButton = document.getElementById('submit-entry-button') as HTMLButtonElement;
		submitEntryButton.addEventListener('click', () => { 
			this.submitEntry() 
		});
	}

	private submitEntry(): void {
		if (this.currentlyEditedEntryID == null) {
			if (this.logInput.value.length > 0) {
				this.noteManager.submitEntry(this.logInput.value, new Date(), this.activeQuotedEntryIndex); // passes back an entry
				this.logInput.value = '';
				this.clearQuotedEntry();
				this.displayCurrentEntries();
				this.updateSaveStateDisplay();
				this.updateLogInputHeight();
			}
		} else {
			try {
				const editedNoteID = this.noteManager.editEntry(this.currentlyEditedEntryID, this.logInput.value, new Date());

				const entryTextElements = document.querySelectorAll(`.entry-text[data-entry-id="${this.currentlyEditedEntryID}"]`);
				for (const element of entryTextElements) {
					element.classList.remove('editing');
				}

				if (editedNoteID == '.overview') {
					this.refreshOverviewPage();
				}

				this.currentlyEditedEntryID = null;
				this.logInput.value = '';
				this.displayCurrentEntries();
				this.updateSaveStateDisplay(editedNoteID);
				this.updateLogInputHeight();

				this.noteManager.writeToCache();
			} catch(err) {
				Notifier.error('Error editing entry: '+err);
			}
		}
	}

	private setupFileInput(): void {
		const attachFileButton = document.getElementById('attach-file-button');
		attachFileButton.addEventListener('click', async () => {
			const files = await open({
				multiple: true,
				directory: false,
			});
			
			if (!files) return;

			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				this.logInput.value += `![image ${i}](${file})`;
				this.noteManager.storeImage(file); // TODO: Delete unused images
			}
		});
	}

	private setupEntryInteraction(): void {
		const entriesMarkdownToggle = document.getElementById('entries-markdown-toggle') as HTMLInputElement;
		entriesMarkdownToggle.addEventListener('change', () => {
			this.renderEntryMarkdown = entriesMarkdownToggle.checked;
			this.displayCurrentEntries();
		})

		this.entryPopupMenu.addEventListener('mouseover', () => {
			this.isPopupMenuActive = true;
		});
		this.entryPopupMenu.addEventListener('mouseleave', () => {
			this.isPopupMenuActive = false;
		});

		this.entryPopupMenu.addEventListener('click', (e) => {
			if (this.highlightedEntryID == null) return;
			const target = e.target as HTMLElement;
			if (target.tagName == 'BUTTON') {
				switch(target.textContent) {
				case 'edit': // possibly evil and bad (should use element id of each popup menu button instead)
					this.editEntry(this.highlightedEntryID);
					break;
				case 'format_quote':
					this.quoteEntry(this.highlightedEntryID);
					break;
				case 'content_copy':
					// copy entry text
					break;
				case 'keep':
					// pin entry:
					break;
				case 'keep_off':
					// unpin entry
					break;
				case 'delete':
					this.deleteEntry(this.highlightedEntryID);
					break;
				}
			}

			// WRITE TO CACHE HERE
		});

		this.entriesContainer.addEventListener('mouseover', (e) => {
			const target = e.target as HTMLElement;
			let span: HTMLSpanElement | null = null;
			if (target.tagName == 'SPAN') {
				span = target.parentElement.querySelector('.entry-text-content');
			} else if (target.classList.contains('entry-content') || target.classList.contains('entry-text')) {
				span = target.querySelector('.entry-text-content:not(.quote-preview-line)');
			}
			if (span) {
				let isImageChild = false;
				if (span.firstElementChild) if (span.firstElementChild.tagName == 'IMG') isImageChild = true;
				if (span.textContent || isImageChild) {
					const inlineTimestampSpan = document.querySelector(`.timestamp-inline[data-entry-id="${this.highlightedEntryID}"]`);
					if (inlineTimestampSpan) {
						inlineTimestampSpan.classList.remove('show');
					}
					this.highlightedEntryID = parseInt(span.parentElement.dataset.entryId); // Possibly an evil and dangerous method

					const nodes = document.querySelectorAll(`.entry-text[data-entry-id="${this.highlightedEntryID}"]`);
					const first = nodes[0] ?? null;
					const last = nodes[nodes.length - 1] ?? null;

					if (first && last) {
						const firstRect = first.getBoundingClientRect();
						const lastRect = last.getBoundingClientRect();
						const parentRect = this.entriesContainer.getBoundingClientRect();

						const margin = 3;
						const top = firstRect.top - parentRect.top - (margin - 2);
						const height = (lastRect.bottom - firstRect.top) + (2 * margin);
						this.entriesContainer.style.setProperty('--line-top', `${top}px`); // These variables determine where the line highlight begins and ends
						this.entriesContainer.style.setProperty('--line-height', `${height}px`);
						
						//if (this.noteManager.getActiveNoteID() != '.overview') {
						this.entryPopupMenu.classList.add('show');
						this.entryPopupMenu.remove();
						
						span.insertAdjacentElement('beforebegin',this.entryPopupMenu);
						this.isPopupMenuActive = true;
						//}
						
						const inlineTimestampSpan = document.querySelector(`.timestamp-inline[data-entry-id="${this.highlightedEntryID}"]`);
						if (inlineTimestampSpan) {
							inlineTimestampSpan.classList.add('show');
						}
					}

				} else {
					this.clearLineHighlighting();
				}
			} else {
				this.clearLineHighlighting();
			}
		});

		this.entriesContainer.addEventListener('mouseleave', () => {
			this.isPopupMenuActive = false;
			this.clearLineHighlighting();
		});
	}

	private quoteEntry(entryID: number): void {
		const quotedEntry: Entry = this.noteManager.getEntry(entryID);
		this.activeQuotedEntryIndex = entryID;
		this.activeQuotePreview.innerHTML = '';
		this.createQuoteElement(quotedEntry, this.activeQuotePreview);
		const header = this.activeQuotePreview.querySelector('.quote-preview-header');
		if (header) {
			const close = document.createElement('button');
			close.classList.add('quote-preview-close');
			close.textContent = '×';
			close.onclick = () => this.clearQuotedEntry();

			header.append(close);
		}
		this.activeQuotePreview.style.display = 'flex';
		
	}

	private createQuoteElement(quotedEntry: Entry, parentContainer: HTMLElement): void {
		const header = document.createElement('div');
		header.className = 'quote-preview-header';

		const timestamp = document.createElement('span');
		timestamp.className = 'timestamp-quoted';
		timestamp.textContent = NoteUtils.formatTime(quotedEntry.created);

		const body = document.createElement('div');
		body.classList.add('quote-preview-body');
		const lines = quotedEntry.text.split('\n');

		for (const line of lines.slice(1)) {
			const lineDiv = document.createElement('div');
			lineDiv.classList.add('quote-preview-line');
			lineDiv.textContent = line;
			body.appendChild(lineDiv);
		}

		const headerLine = document.createElement('span');
		headerLine.classList.add('quote-preview-line');
		headerLine.textContent = lines[0];
		header.append(timestamp, headerLine);
		
		parentContainer.append(header, body);

		if (body.scrollHeight > 500) {
			body.classList.add('collapsed');
		}

		body.onclick = () => {
			const target = this.entriesContainer.querySelector(`[data-entry-id="${quotedEntry.id}"]`);
			target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		};
	}

	private clearQuotedEntry(): void {
		this.activeQuotedEntryIndex = null;
		this.activeQuotePreview.innerHTML = '';
		this.activeQuotePreview.style.display = 'none';
		this.logInput.focus();
	}

	private editEntry(entryID: number): void {
		console.log('editing pass 1');
		const entryText: string = this.noteManager.getEntryText(this.highlightedEntryID);
		if (entryText) {
			this.currentlyEditedEntryID = entryID;
			this.logInput.disabled = false;
			this.logInput.value = entryText;
			this.updateLogInputHeight();
			this.logInput.focus();

			const entryTextElements = document.querySelectorAll(`.entry-text[data-entry-id="${entryID}"]`);
			for (const element of entryTextElements) {
				element.classList.add('editing');
			}
		}
	}

	private deleteEntry(entryID: number): void {
		try {
			const affectedNote = this.noteManager.deleteEntry(entryID);

			if (affectedNote) {
				this.updateSaveStateDisplay(affectedNote);
				this.displayCurrentEntries();
				this.noteManager.writeToCache();
			}
		} catch(err) {
			Notifier.error('Error while deleting entry: '+err);
		}
	}

	private clearLineHighlighting(): void {
		if (!this.isPopupMenuActive && this.entryPopupMenu.parentElement) {
			const inlineTimestampSpan = document.querySelector(`.timestamp-inline[data-entry-id="${this.highlightedEntryID}"]`);
			if (inlineTimestampSpan) {
				inlineTimestampSpan.classList.remove('show');
			}
			
			this.entriesContainer.style.setProperty('--line-top', '0px');
			this.entriesContainer.style.setProperty('--line-height', '0px');

			this.entryPopupMenu.classList.remove('show');
			this.entryPopupMenu.remove();

			this.highlightedEntryID = null;

		}
	}


	private createNoteTab(noteID: string, title: string): void {
		const noteTabDiv = document.createElement('div');
		noteTabDiv.classList.add('tab');

		const radioElement: HTMLInputElement = document.createElement('input');
		radioElement.type = 'radio';
		radioElement.id = noteID;
		radioElement.name = 'note-tabs';
		radioElement.classList.add('tab-input');

		const labelElement: HTMLLabelElement = document.createElement('label');
		labelElement.classList.add('tab-label');
		labelElement.htmlFor = noteID;
		labelElement.textContent = title;

		noteTabDiv.appendChild(radioElement);
		noteTabDiv.appendChild(labelElement);
		this.noteTabsContainer.appendChild(noteTabDiv);
		
		if (noteID != '.overview') this.logInput.focus();
	}

	private addNewNote(title?: string): void {
		const newnoteID = this.noteManager.createNewNote(title);
		this.openNote(newnoteID);
		this.selectNoteTab(newnoteID);
	}

	private openNote(noteID: string): void {
		try {
			const noteData = this.noteManager.openNoteData(noteID);
			if (!noteData) {
				Notifier.error(`Unknown error opening note ${noteID}!`);
				return;
			}
			this.createNoteTab(noteData.id, noteData.title);
			this.setCurrentNote(noteData.id);
		} catch (err) {
			Notifier.error('Error opening note: '+err);
		}
	}

	private closeNote(noteID: string): void {
		try {
			const newnoteID = this.noteManager.closeNote(noteID);

			this.removeNoteTab(noteID);

			this.selectNoteTab(newnoteID);
			this.setCurrentNote(newnoteID);
		} catch (err) {
			Notifier.error('Error closing note: '+err);
		}
	}

	private closeCurrentNote(): void {
		const currentnoteID = this.noteManager.getActiveNoteID();
		if (currentnoteID == '.overview') return;

		this.closeNote(currentnoteID);
	}

	private async saveCurrentNote(): Promise<void> {
		try {
			const currentnoteID = this.noteManager.getActiveNoteID();
			if (currentnoteID != '.overview') this.noteManager.updatePersistentText(this.tinyMDE.getContent());

			const result = await this.noteManager.saveNote(currentnoteID);

			if (result) {
				if (result.success) {
					if (result.oldID != result.newID) {
						this.updateNoteTabsID(result.oldID, result.newID, result.newTitle);
					} else {
						Notifier.success(`Saved as ${result.newID}.md`);
					}
					await this.noteManager.saveMetadata();
					this.updateNoteLabelDisplay(result.newID, result.newTitle, false); // ALSO CHECK IF BAD
					this.updateTitleDisplay(result.newTitle, false);
				} else {
					Notifier.error('Unknown error saving current note!');
				}
			} else {
				Notifier.error('Unknown error saving current note!');
			}
		} catch (err) {
			Notifier.error('Error saving current note: '+err);
		}
	}

	private async saveAllNotes(): Promise<void> {
		if (!this.noteManager.isAnythingUnsaved()) return;
		try {
			this.noteManager.updatePersistentText(this.tinyMDE.getContent());
			let allSuccessful = true;
			const results = await this.noteManager.saveAllNotes();
			for (const result of results) {
				if (result.success) {
					if (result.oldID != result.newID) {
						this.updateNoteTabsID(result.oldID, result.newID, result.newTitle);
					}
					this.updateNoteLabelDisplay(result.newID, result.newTitle, false); // CHECK
				} else {
					allSuccessful = false;
					Notifier.error(`Unknown error saving note: ${result.newID}`);
				}
			}
			if (allSuccessful) Notifier.success('Saved all notes');
		} catch (err) {
			Notifier.error('Error saving current note: '+err);
		}
	}

	private removeNoteTab(noteID: string): void {
		const radioElement = document.getElementById(noteID) as HTMLInputElement;
		const noteTabDiv = radioElement.parentElement as HTMLDivElement;
		noteTabDiv.remove();
	}

	private selectNoteTab(noteID: string): void {
		const noteTab = document.getElementById(noteID) as HTMLInputElement;
		noteTab.checked = true;
		this.setCurrentNote(noteID);
	}

	private setCurrentNote(noteID: string): void {
		this.noteManager.updatePersistentText(this.tinyMDE.getContent()); // Save before changing notes!
		const result = this.noteManager.changeCurrentNote(noteID);

		if (!result) {
			Notifier.error(`Error changing note to ${noteID}!`);
			return;
		}

		const overviewControls = document.getElementById('overview-controls') as HTMLDivElement;
		
		if (noteID == '.overview') {
			overviewControls.classList.add('show');
			// Disable editing tinymde
			this.tinyMDE.e.setAttribute('contenteditable','false');
			this.refreshOverviewPage();
			
		} else {
			this.tinyMDE.e.setAttribute('contenteditable','true');
			overviewControls.classList.remove('show');
			this.logInput.disabled = false;
		}

		// load persistent text content
		this.tinyMDE.setContent(this.noteManager.getPersistentText(result));

		this.updateSaveStateDisplay();
		this.displayCurrentEntries();
		this.noteManager.writeToCache();
	}

	private updateNoteTabsID(oldId: string, newId: string, newTitle: string): void {
		const noteRadio = document.getElementById(oldId) as HTMLInputElement;
		const noteLabel = document.querySelector(`label[for="${oldId}"]`) as HTMLLabelElement;

		noteRadio.id = newId;
		noteLabel.htmlFor = newId;
		noteLabel.textContent = newTitle.slice(0,this.noteManager.userSettings.maxTabTitleLength);

		this.updateSaveStateDisplay();
	}

	private displayCurrentEntries(): void {
		const entries = this.noteManager.getCurrentEntries();
		this.entriesContainer.innerHTML = '';
		
		if (entries.length == 0) return;
		for (let i = 0; i < entries.length; i++) {
			const groupStartEntry = entries[i];
			const currentGroupId = groupStartEntry.groupId;

			let lastEdited: Date | null = null;
			const splitLines: [number, string][] = [];
			let nextIndex = i;
			
			while (nextIndex < entries.length && entries[nextIndex].groupId == currentGroupId) {
				const entry = entries[nextIndex];

				if (entry.lastEdited) {
					if (!lastEdited) {
						lastEdited = entry.lastEdited;
					} else if (entry.lastEdited > lastEdited) {
						lastEdited = entry.lastEdited;
					}
				}
				
				if (this.renderEntryMarkdown) {
					const nodes = this.markdownParser.parseLine(entry.text);
					const lines = this.markdownParser.renderHTML(nodes).split('\n');
					for (const line of lines) {
						splitLines.push([nextIndex, line]);
					}
				} else { // CHECK
					for (const line of entry.text.split('\n')) {
						splitLines.push([nextIndex, line]);
					}
				}
				nextIndex++;
			}

			const entryDiv = document.createElement('div');
			entryDiv.classList.add('entry-content');

			const entryHeader = document.createElement('div');
			entryHeader.classList.add('entry-header');

			const headingBreak = document.createElement('hr');
			entryHeader.appendChild(headingBreak);
			
			const timestampSpan = document.createElement('span');
			// TODO: Go through the entire group and get the most recently edited date, and use that
			
			let timestampContent = NoteUtils.getRelativeTime(entries[i].created);
			if (lastEdited) timestampContent = 'Edited '+(NoteUtils.getRelativeTime(lastEdited).toLowerCase());
			timestampSpan.textContent = timestampContent;
			entryHeader.appendChild(timestampSpan);

			entryDiv.appendChild(entryHeader);

			//const splitLines = textContent.split('\n');
			let parents: HTMLDivElement[] = [];

			for (let j = 0; j < splitLines.length; j++) {
				const index = splitLines[j][0];
				const line = splitLines[j][1];
				const indentLevel = NoteUtils.countLeadingTabs(line,this.noteManager.userSettings.indentString);
				const text = NoteUtils.stripLeadingTabs(line,this.noteManager.userSettings.indentString);

				const entryTextDiv = document.createElement('div');
				entryTextDiv.classList.add('entry-text');
				entryTextDiv.dataset.entryId = `${entries[index].id}`;
				let hasChildren = false;
				if (j < splitLines.length - 1) {
					const nextIndent = NoteUtils.countLeadingTabs(splitLines[j + 1][1],this.noteManager.userSettings.indentString);
					hasChildren = nextIndent > indentLevel;
				}

				if (hasChildren) {
					const disclosureWidget = document.createElement('span');
					disclosureWidget.classList.add('disclosure-widget');
					entryTextDiv.appendChild(disclosureWidget);
				}

				if (j == 0 || index > splitLines[j - 1][0]){
					const inlineTimestampSpan = document.createElement('div');
					inlineTimestampSpan.classList.add('timestamp-inline');
					inlineTimestampSpan.textContent = NoteUtils.formatTime(entries[index].created);
					inlineTimestampSpan.dataset.entryId = `${entries[index].id}`;
					entryTextDiv.appendChild(inlineTimestampSpan);
				}

				const entryTextSpan = document.createElement('span');
				entryTextSpan.classList.add('entry-text-content');
				// PARSE INLINE HERE?

				entryTextSpan.innerHTML = text;
				entryTextDiv.appendChild(entryTextSpan);


				const quotedId = entries[index].quotedId;
				if (quotedId !== undefined && quotedId >= 0 && quotedId < entries.length) {
					const quotedEntry = entries[quotedId];

					const quotedBlock = document.createElement('div');
					quotedBlock.classList.add('quoted-entry');

					this.createQuoteElement(quotedEntry, quotedBlock);
					entryTextDiv.insertBefore(quotedBlock, entryTextSpan); // show quote above text
				}

				let parentContainer = entryDiv;
				for (let k = 0; k < indentLevel; k++) {
					if (!parents[k]) {
						const emptyDiv = document.createElement('div');
						emptyDiv.classList.add('entry-text');
						parentContainer.appendChild(emptyDiv);
						parents[k] = emptyDiv;
					}
					parentContainer = parents[k];
				}

				parentContainer.appendChild(entryTextDiv);
				parents = parents.slice(0, indentLevel);
				parents[indentLevel] = entryTextDiv;
			}

			if (this.entriesContainer.childElementCount > 0) {
				this.entriesContainer.insertBefore(entryDiv,this.entriesContainer.firstElementChild);
			} else {
				this.entriesContainer.appendChild(entryDiv);
			}

			i = nextIndex - 1;
		}

		const imageElements = this.entriesContainer.querySelectorAll('img');
		imageElements.forEach(async img => {
			const imgData = this.noteManager.fetchImageData(img.dataset.srcpath);

			if (imgData) {
				const data = await NoteUtils.getImageAsBase64(imgData.uuid);
				img.src = `data:${imgData.type};base64,${data}`;
			}
		});
	}


	private updateSaveStateDisplay(noteID?: string): void {
		const noteData = this.noteManager.getNoteData(noteID);
		if (!noteData) return; //TODO

		if (noteData.id == this.noteManager.getActiveNoteID()) this.updateTitleDisplay(noteData.title, noteData.isUnsaved);
		this.updateNoteLabelDisplay(noteData.id, noteData.title, noteData.isUnsaved);
	}

	private updateNoteLabelDisplay(noteID: string, noteTitle: string, isUnsaved: boolean): void {
		const noteLabelElement = document.querySelector(`label[for="${noteID}"]`) as HTMLLabelElement;

		if (!noteLabelElement) return;
		if (noteID != '.overview') noteLabelElement.textContent = (isUnsaved ? '* ' : '') + (noteTitle).slice(0,this.noteManager.userSettings.maxTabTitleLength);
		if (noteTitle.length > this.noteManager.userSettings.maxTabTitleLength) noteLabelElement.textContent += '...';
	}

	private updateTitleDisplay(noteTitle: string, isUnsaved: boolean): void {
		const noteTitleElement = document.getElementById('note-title') as HTMLInputElement;
		noteTitleElement.value = (isUnsaved ? '* ' : '') + noteTitle;
	}

	private insertNewLine(): void {
		const input = this.logInput;
		const cursorPos = input.selectionStart || 0; // current cursor position

		const valueBeforeCursor = input.value.slice(0, cursorPos);
		const valueAfterCursor = input.value.slice(cursorPos);

		// Count indentation from the line where the cursor is
		const lineStart = valueBeforeCursor.lastIndexOf('\n') + 1; // start of current line
		const currentLine = valueBeforeCursor.slice(lineStart);
		this.currentIndentationLevel = NoteUtils.countLeadingTabs(currentLine, this.noteManager.userSettings.indentString);

		// Prepare the new line with indentation
		const newLine = '\n' + this.noteManager.userSettings.indentString.repeat(this.currentIndentationLevel);

		// Insert the new line at the cursor
		input.value = valueBeforeCursor + newLine + valueAfterCursor;

		// Move the cursor to the start of the new line
		const newCursorPos = cursorPos + newLine.length;
		input.setSelectionRange(newCursorPos, newCursorPos);

		this.updateLogInputHeight();
	}


	private updateLogInputHeight(): void {
		this.logInput.style.height = '0px';
		this.logInput.style.height = this.logInput.scrollHeight + 'px';
	}
}