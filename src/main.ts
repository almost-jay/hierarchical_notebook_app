import { Entry } from './entry';
import { Note } from './note';
import { NoteUtils } from './note-utils';
import { Overview } from './overview';
import { ToastManager } from './toast-manager';

class Manager {
	private notes: Note[] = [];
	private overview: Overview;
	private activeNoteIndex: number;
	private userSettings: UserSettings = {
		indentString: '\t',
		groupInterval: 5, // minutes
		noteIndexFileName: '.note-headings',
		toastDuration: 3000, //ms
	};
	private noteTabsContainer: HTMLDivElement;
	private logInput: HTMLTextAreaElement;
	private persistentTextInput: HTMLTextAreaElement;
	private currentIndentationLevel: number = 0;
	private toastManager: ToastManager;

	private draggedTab: HTMLDivElement | null = null;

	public constructor() {
		this.noteTabsContainer = document.getElementById('note-tabs') as HTMLDivElement;
		this.toastManager = new ToastManager(this.userSettings.toastDuration);
		this.logInput = document.getElementById('log-input') as HTMLTextAreaElement;
		this.persistentTextInput = document.getElementById('persistent-text-input') as HTMLTextAreaElement;

		this.initialiseNotes();
		this.initialiseOverview();
		this.updateOverview();
		this.initialiseInput();
		// TODO: Also store and fetch user settings
		// TODO: Also cache and load data
	}

	private initialiseNotes(): void {

		// TODO: Load a note from the dang cache
		// Also the overview is in Notes
		this.loadAllNotes(); 
		this.noteTabsContainer.innerHTML = '';
		// FOR i in note
		// do:
		// uhhh render it or sum idfk
		// STUB FUNCTION
	}

	private initialiseOverview(): Overview {
		if (this.overview) return;

		const overview = new Overview();
		this.notes.unshift(overview);
		this.overview = overview;
	}

	private initialiseInput(): void {
		window.addEventListener('keydown', (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == 's') {
				e.preventDefault();
				this.saveNotes(e.shiftKey); // Saves all notes on Ctrl + Shift + S, and just the active one on Ctrl + S
			} else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
				e.preventDefault();
				this.addNewNote(`Untitled ${this.notes.length}`);
				this.setCurrentNote(this.notes[this.notes.length - 1].id);
			}
		});

		this.persistentTextInput.addEventListener('keyup', (e) => {
			if (e.key == ' ' || e.key == 'Enter') this.updatePersistentText();
		});
				
		const sidebar = document.getElementById('sidebar') as HTMLFormElement;
		sidebar.addEventListener('click', (e) => {
			const target = e.target as HTMLElement;
			if (target.className == 'tab-input') {
				this.setCurrentNote(target.id);
			}

		});

		const addNotetab = document.getElementById('add-note-tab') as HTMLDivElement;
		addNotetab.addEventListener('click', (e) => {
			e.preventDefault();
			this.addNewNote(`Untitled ${this.notes.length}`);
			this.setCurrentNote(this.notes[this.notes.length - 1].id);
		});

		const overviewDateSelector = document.getElementById('start-date-selector') as HTMLInputElement;
		overviewDateSelector.min = this.overview.earliestDate;
		overviewDateSelector.max = this.overview.currentDate;
		overviewDateSelector.addEventListener('change', () => {
			const newDate = new Date(overviewDateSelector.value);
			this.overview.updateSelectedDate(newDate);
		});

		const overviewDateRangeSelector = document.getElementById('date-range-selector') as HTMLInputElement;
		overviewDateRangeSelector.addEventListener('change', () => {
			const newDateRange = parseInt(overviewDateRangeSelector.value);
			this.overview.updateSelectedDateRange(newDateRange);
		});

		const overviewDayPrev = document.getElementById('day-prev') as HTMLButtonElement;
		const overviewDayNext = document.getElementById('day-next') as HTMLButtonElement;

		overviewDayPrev.disabled = this.overview.isCurrentDateEarliest();
		overviewDayNext.disabled = this.overview.isCurrentDateLatest();

		overviewDayPrev.addEventListener('click', () => {
			this.overview.stepBackward();
			overviewDayPrev.disabled = this.overview.isCurrentDateEarliest();
		});

		overviewDayNext.addEventListener('click', () => { 
			this.overview.stepForward(); 
			overviewDayNext.disabled = this.overview.isCurrentDateLatest();
		});


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
			// console.log(e);
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
		submitEntryButton.addEventListener('click', () => { this.submitEntry() });

	}

	private displayCurrentEntries(): void {
		if (this.activeNoteIndex == null) return; // TODO
		
		this.updateNoteTitleDisplay();

		const entriesContainer = document.getElementById('entry-container') as HTMLDivElement;
		entriesContainer.innerHTML = '';

		const entries = this.notes[this.activeNoteIndex].entries; // We are using .entries here instead of getOwnEntries deliberately

		if (entries.length == 0) return;

		for (let currentIndex = 0; currentIndex < entries.length; ) {
			const groupStartEntry = entries[currentIndex];
			const currentGroupId = groupStartEntry.groupId;
			
			let textContent = groupStartEntry.text;
			let nextIndex = currentIndex + 1;

			while (nextIndex < entries.length && entries[nextIndex].groupId === currentGroupId) {
				textContent += '\n' + entries[nextIndex].text;
				nextIndex++;
			}

			const entryDiv = document.createElement('div');
			entryDiv.classList.add('entry-content');

			const entryHeader = document.createElement('div');
			entryHeader.classList.add('entry-header');

			const headingBreak = document.createElement('hr');
			entryHeader.appendChild(headingBreak);

			const timestampSpan = document.createElement('span');
			timestampSpan.textContent = NoteUtils.formatDate(entries[currentIndex].created); // TODO: Relative/contextual/fuzzy time
			entryHeader.appendChild(timestampSpan);

			entryDiv.appendChild(entryHeader);

			const splitLines = textContent.split('\n');
			let parents: HTMLDivElement[] = [];

			for (let i = 0; i < splitLines.length; i++) {
				const line = splitLines[i];
				const indentLevel = this.countLeadingTabs(line);
				const text = this.stripLeadingTabs(line);

				const entryTextDiv = document.createElement('div');
				entryTextDiv.classList.add('entry-text');

				let hasChildren = false;
				if (i < splitLines.length - 1) {
					const nextIndent = this.countLeadingTabs(splitLines[i + 1]);
					hasChildren = nextIndent > indentLevel;
				}

				if (hasChildren) {
					const disclosureWidget = document.createElement('span');
					disclosureWidget.classList.add('disclosure-widget');
					entryTextDiv.appendChild(disclosureWidget);
				}

				const entryTextSpan = document.createElement('span');
				entryTextSpan.textContent = text;
				entryTextDiv.appendChild(entryTextSpan);

				let parentContainer = entryDiv;
				for (let j = 0; j < indentLevel; j++) {
					if (!parents[j]) {
						const emptyDiv = document.createElement('div');
						emptyDiv.classList.add('entry-text');
						parentContainer.appendChild(emptyDiv);
						parents[j] = emptyDiv;
					}
					parentContainer = parents[j];
				}

				parentContainer.appendChild(entryTextDiv);
				parents = parents.slice(0, indentLevel);
				parents[indentLevel] = entryTextDiv;
			}

			entriesContainer.appendChild(entryDiv);

			currentIndex = nextIndex;
		}

	}

	private setCurrentNote(noteId: string): void { // CHECK: Should this be renamed because it really mainly renders the note
		const overviewControls = document.getElementById('overview-controls') as HTMLDivElement;
		if (this.activeNoteIndex == 0) {
			overviewControls.classList.remove('show');
		}

		this.activeNoteIndex = this.notes.findIndex(note => note.id === noteId);

		if (!this.notes[this.activeNoteIndex]) return; // TODO

		this.updateNoteTitleDisplay();

		if (this.activeNoteIndex == 0) {
			overviewControls.classList.add('show');
			this.updateOverview();
			this.persistentTextInput.value = ''; // TODO: Display persistent text for overview
			this.persistentTextInput.readOnly = true;
		} else {
			this.persistentTextInput.value = this.notes[this.activeNoteIndex].getPersistentTextContent();
			this.persistentTextInput.readOnly = false;
		}

		this.displayCurrentEntries();
	}

	private addNewNote(noteTitle: string): Note { // TODO: make sure there is enough space for the note?
		const newNote = new Note(noteTitle);
		this.notes.push(newNote);
		this.activeNoteIndex = this.notes.length - 1;

		this.addNoteElements(newNote);

		return newNote;
	}

	private updateNoteTitleDisplay(): void {
		if (!this.notes[this.activeNoteIndex]) return;
		const noteTitle = document.getElementById('note-title');
		const isUnsaved = this.notes[this.activeNoteIndex].isUnsaved();
		noteTitle.textContent = (isUnsaved ? '* ' : '') + this.notes[this.activeNoteIndex].title; // CHECK: Would this work better as an .unsaved class with ::before and color: var(--text-alt)
	}


	private addNoteElements(note: Note): void {
		const noteTabDiv = document.createElement('div');
		noteTabDiv.classList.add('tab');
		noteTabDiv.draggable = true;

		noteTabDiv.addEventListener('dragstart', this.tabDragStartHandler);
		noteTabDiv.addEventListener('dragover', this.tabDragOverHandler);
		noteTabDiv.addEventListener('dragend', this.tabDragEndHandler);

		const radioElement: HTMLInputElement = document.createElement('input');
		radioElement.type = 'radio';
		radioElement.id = note.id;
		radioElement.name = 'note-tabs';
		radioElement.classList.add('tab-input');

		const labelElement: HTMLLabelElement = document.createElement('label');
		labelElement.classList.add('tab-label');
		labelElement.htmlFor = note.id;
		labelElement.textContent = note.title;

		noteTabDiv.appendChild(radioElement);
		noteTabDiv.appendChild(labelElement);
		this.noteTabsContainer.appendChild(noteTabDiv);

		radioElement.checked = true;
		this.logInput.focus();
	}

	private tabDragStartHandler(event: DragEvent): void {
		console.log(event.currentTarget);
		this.draggedTab = event.currentTarget as HTMLDivElement;
		this.draggedTab.classList.add('dragging');
	}

	private tabDragOverHandler(event: DragEvent): void {
		event.preventDefault();
		console.log('DRAG OVER!!');
		if (!this.draggedTab) return;
		console.log(event.currentTarget);
		const target = event.currentTarget as HTMLElement;

		const rect = target.getBoundingClientRect();
		const isAfter = event.clientY > rect.top + rect.height / 2;

		target.parentNode!.insertBefore(this.draggedTab, isAfter ? target.nextSibling : target);

		if (target == this.draggedTab) return;
	}

	private tabDragEndHandler(): void {
		if (!this.draggedTab) return;
		console.log(this.draggedTab);
		this.draggedTab.classList.remove('dragging');
		this.draggedTab = null;

	}

	private insertNewLine(): void {
		const lines = this.logInput.value.split('\n');
		const currentLine = lines[lines.length - 1];
		this.currentIndentationLevel = this.countLeadingTabs(currentLine);

		const newLine = '\n' + this.userSettings.indentString.repeat(this.currentIndentationLevel);
		this.logInput.value += newLine;

		this.updateLogInputHeight();
	}

	private updateLogInputHeight(): void {
		this.logInput.style.height = '0px';
		this.logInput.style.height = this.logInput.scrollHeight + 'px';
	}

	private updatePersistentText(): void {
		if (this.activeNoteIndex == 0) return;
		if (!this.notes[this.activeNoteIndex]) return;

		this.notes[this.activeNoteIndex].updatePersistentTextContent(this.persistentTextInput.value);
		this.updateNoteTitleDisplay();
	}

	private submitEntry(): void {
		const entryText = this.logInput.value;
		if (entryText.trim().length == 0) return;
		if (this.activeNoteIndex == null) return; // TODO

		const note = this.notes[this.activeNoteIndex];
		const currentTime = new Date();

		let groupId = 0;
		const entries = note.getOwnEntries();

		if (entries.length > 0) {
			groupId = entries[entries.length - 1].groupId;
			const previousEntryCreated = entries[entries.length - 1].created;
			const timeSincePreviousEntry = currentTime.getTime() - previousEntryCreated.getTime();
			if (timeSincePreviousEntry / 60000 > this.userSettings.groupInterval) { // divide by 60000 ∵ ms -> minutes
				groupId++;
			}
		}

		const splitLines = entryText.split('\n');
		const indentLevel = this.countLeadingTabs(splitLines[splitLines.length - 1]);
		const newEntry = new Entry(entries ? entries.length : 0, groupId, entryText, currentTime, indentLevel);
		note.addEntry(newEntry);

		// TODO: Verify that the entry was submitted before clearing textarea

		this.logInput.value = (this.userSettings.indentString).repeat(indentLevel);
		this.updateLogInputHeight();

		if (this.activeNoteIndex == 0) this.updateOverview();
		
		this.displayCurrentEntries();
	}

	private updateOverview(): void {
		const allEntries = [];
		this.overview.clearEntries();
		for (const note of this.notes) {
			allEntries.push(...note.entries.map(entry => ({ entry: entry, sourceNoteId: note.id })));  // Deliberately using .entries instead of getOwnEntries here
		}
		this.overview.updateEntries(allEntries);
	}

	private async loadAllNotes(): Promise<void> {
		// Check if the headings file exists
		// If it does, we will add new notes
		const notesAdded = [];
		if (await NoteUtils.doesFileExist(this.userSettings.noteIndexFileName+'.md')) {
			this.toastManager.show('info',`Loading notes from ${this.userSettings.noteIndexFileName}.md`);
			const noteIdList: string[] = (await NoteUtils.getMarkdownFile(this.userSettings.noteIndexFileName)).split('\n');
			for (const noteId of noteIdList) {
				if (noteId == '') continue;
				
				if (noteId == '.overview') {
					const newOverview: Overview = await Overview.loadFromFile();
					if (!newOverview) this.toastManager.show('error','Could not load Overview');
					this.notes.unshift(newOverview)
					this.overview = newOverview;
				} else {
					const newNote = await Note.loadFromFile(noteId);
					if (!newNote) this.toastManager.show('error',`Could not load note ${noteId}`);
					this.notes.push(newNote);
					notesAdded.push(newNote.id);
					this.addNoteElements(newNote);
				}
			}
			if (notesAdded.length > 0) {
				const noteTab = document.getElementById(notesAdded[0]) as HTMLInputElement;
				noteTab.checked = true;
				this.setCurrentNote(notesAdded[0]);
				this.updateNoteTitleDisplay();
			}
		} else { 
			this.toastManager.show('error',`Could not find headings file ${this.userSettings.noteIndexFileName}.md`);
		}

	}

	private async saveNotes(saveAll: boolean = false): Promise<void> {
		if (!(saveAll || this.notes[this.activeNoteIndex].isUnsaved())) return;
		let noteHeadings = '';
		for (let i = 0; i < this.notes.length; i++) {
			const note = this.notes[i];
			noteHeadings += note.id+'\n';
			note.updatePersistentTextContent(this.persistentTextInput.value);
			if (saveAll) await note.save();

		}
		if (!saveAll) {
			const result = await this.notes[this.activeNoteIndex].save();
			if (result) {
				this.toastManager.show('info',`Saved as ${this.notes[this.activeNoteIndex].id}.md`);
				await NoteUtils.writeMarkdownFile(this.userSettings.noteIndexFileName,noteHeadings);
			}
		} else {
			this.toastManager.show('info','Saved all notes');
		}
		this.updateNoteTitleDisplay();
	}
	
	private countLeadingTabs(line: string): number {
		return line.match(new RegExp(`^${this.userSettings.indentString}+`))?.[0].length || 0;

	}

	private stripLeadingTabs(line: string): string {
		return line.replace(new RegExp(`^${this.userSettings.indentString}+`), '');
	}
}

type UserSettings = {
	indentString: string;
	groupInterval: number;
	noteIndexFileName: string;
	toastDuration: number;
};

const _manager = new Manager();