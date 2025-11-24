import { Entry } from './entry';
import { NoteManager } from './note-manager';
import { NoteSelector } from './note-selector';
import { NoteUtils } from './note-utils';
import { ToastManager } from './toast-manager';

export class UIManager {
	private noteTabsContainer: HTMLDivElement;
	private entriesContainer: HTMLDivElement;
	private logInput: HTMLTextAreaElement;
	private persistentTextInput: HTMLTextAreaElement;
	private currentIndentationLevel: number = 0;
	private draggedTab: HTMLDivElement | null = null;
	private noteSelector: NoteSelector;
	private toastManager: ToastManager;
	private noteManager: NoteManager;

	public constructor() {
		this.noteTabsContainer = document.getElementById('note-tabs') as HTMLDivElement;
		this.entriesContainer = document.getElementById('entry-container') as HTMLDivElement;
		this.logInput = document.getElementById('log-input') as HTMLTextAreaElement;
		this.persistentTextInput = document.getElementById('persistent-text-input') as HTMLTextAreaElement;

		this.noteTabsContainer.innerHTML = '';
		this.entriesContainer.innerHTML = '';

		this.noteManager = new NoteManager();
		this.toastManager = new ToastManager(this.noteManager.userSettings.toastDuration);
		this.noteSelector = new NoteSelector((noteId) => {
			this.openNote(noteId);
		});

		this.initialiseInput();
	}
	
	public async initialiseAsync(): Promise<void> {
		try {
			await this.noteManager.loadUserSettings();
		} catch (err) {
			this.toastManager.show('error','Error loading notes: '+err);
		}

		let result = [];
		try {
			result = await this.noteManager.loadAllNotes();
			if (result.length > 0) {
				this.toastManager.show('info','Loaded all notes from headings file');
			}
		} catch (err) {
			this.toastManager.show('error','Error loading notes: '+err);
		}
		try {
			const openNotes = await this.noteManager.restorePreviousSession();

			openNotes.forEach(noteData => {
				this.createNoteTab(noteData.id, noteData.title);
				this.updateSaveStateDisplay(noteData.id);
			})

			const currentNote = this.noteManager.getActiveNoteID();
			this.setCurrentNote(currentNote);
		} catch (err) {
			this.toastManager.show('error','Error loading notes: '+err);
		}
		
	}

	private initialiseInput(): void {
		this.setupPersistentTextHandlers();
		this.setupKeyboardShortcuts();
		this.setupSidebarClickHandler();
		this.setupTabDragging();
		this.setupOverviewDateSelectors();
		this.setupLogInput();
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
				this.noteSelector.showModal(unopenedNotes);
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
		this.persistentTextInput.addEventListener('keyup', (_e) => {
			if (this.draggedTab) return;
			const saveStateChanged = this.noteManager.updatePersistentText(this.persistentTextInput.value);
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
			document.body.style.userSelect = 'none';
			document.body.style.webkitUserSelect = 'none';
		});

		window.addEventListener('mouseup', () => {
			if (!this.draggedTab) return;
			
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
					this.noteTabsContainer.insertBefore(this.draggedTab, tab);
					inserted = true;
					break;
				}
			}

			if (!inserted) this.noteTabsContainer.appendChild(this.draggedTab);
			
		});
	}

	private setupOverviewDateSelectors(): void {
		const overviewDateSelector = document.getElementById('start-date-selector') as HTMLInputElement;
		const overviewDates = this.noteManager.overview.getDates();
		overviewDateSelector.min = overviewDates.earliest;
		overviewDateSelector.max = overviewDates.latest;

		overviewDateSelector.addEventListener('change', () => {
			const newDate = new Date(overviewDateSelector.value);
			this.noteManager.overview.updateSelectedDate(newDate);
		});

		const overviewDateRangeSelector = document.getElementById('date-range-selector') as HTMLInputElement;
		overviewDateRangeSelector.addEventListener('change', () => {
			const newDateRange = parseInt(overviewDateRangeSelector.value);
			this.noteManager.overview.updateSelectedDateRange(newDateRange);
		});

		const overviewDayPrev = document.getElementById('day-prev') as HTMLButtonElement;
		const overviewDayNext = document.getElementById('day-next') as HTMLButtonElement;

		overviewDayPrev.disabled = this.noteManager.overview.isCurrentDateEarliest();
		overviewDayNext.disabled = this.noteManager.overview.isCurrentDateLatest();

		overviewDayPrev.addEventListener('click', () => {
			this.noteManager.overview.stepBackward();
			overviewDayPrev.disabled = this.noteManager.overview.isCurrentDateEarliest();
		});

		overviewDayNext.addEventListener('click', () => { 
			this.noteManager.overview.stepForward(); 
			overviewDayNext.disabled = this.noteManager.overview.isCurrentDateLatest();
		});
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
		submitEntryButton.addEventListener('click', () => { 
			this.submitEntry() 
		});
	}

	private submitEntry(): void {
		this.noteManager.submitEntry(this.logInput.value, new Date());
		this.displayCurrentEntries();
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

	private addNewNote(): void {
		const newNoteID = this.noteManager.createNewNote();
		this.openNote(newNoteID);
	}

	private openNote(noteID: string): void {
		try {
			const noteData = this.noteManager.openNoteData(noteID);
			if (!noteData) {
				this.toastManager.show('error',`Unknown error opening note ${noteID}!`);
				return;
			}
			this.createNoteTab(noteData.id, noteData.title);
			this.setCurrentNote(noteData.id);
		} catch (err) {
			this.toastManager.show('error','Error opening note: '+err);
		}
	}

	private closeNote(noteID: string): void {
		try {
			const newNoteID = this.noteManager.closeCurrentNote();

			const radioElement = document.getElementById(noteID) as HTMLInputElement;
			const noteTabDiv = radioElement.parentElement as HTMLDivElement;
			noteTabDiv.remove();

			this.selectNoteTab(newNoteID);
			this.setCurrentNote(newNoteID);
		} catch (err) {
			this.toastManager.show('error','Error closing note: '+err);
		}
	}

	private closeCurrentNote(): void {
		try {
			const activeNoteID = this.noteManager.getActiveNoteID();
			this.closeNote(activeNoteID);
		} catch (err) {
			this.toastManager.show('error','Error closing note: '+err);
		}
	}

	private async saveCurrentNote(): Promise<void> {
		try {
			this.noteManager.updatePersistentText(this.persistentTextInput.value);

			const currentNoteID = this.noteManager.getActiveNoteID();
			const result = await this.noteManager.saveNote(currentNoteID);

			if (result) {
				if (result.success) {
					if (result.oldID != result.newID) {
						this.updateNoteTabsID(result.oldID, result.newID, result.newTitle);
					} else {
						this.toastManager.show('info',`Saved as ${result.newID}.md`);
					}
					await this.noteManager.saveMetadata();
					this.updateNoteLabelDisplay(result.newID, result.newTitle, false); // ALSO CHECK IF BAD
					this.updateTitleDisplay(result.newID, result.newTitle, false);
				} else {
					this.toastManager.show('error','Unknown error saving current note!');
				}
			} else {
				this.toastManager.show('error','Unknown error saving current note!');
			}
		} catch (err) {
			this.toastManager.show('error','Error saving current note: '+err);
		}
	}

	private async saveAllNotes(): Promise<void> {
		try {
			this.noteManager.updatePersistentText(this.persistentTextInput.value);
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
					this.toastManager.show('error',`Unknown error saving note: ${result.newID}`);
				}
			}
			if (allSuccessful) this.toastManager.show('info','Saved all notes');
		} catch (err) {
			this.toastManager.show('error','Error saving current note: '+err);
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
		this.noteManager.updatePersistentText(this.persistentTextInput.value);
		const result = this.noteManager.changeCurrentNote(noteID);

		if (!result) {
			this.toastManager.show('error',`Error changing note to ${noteID}!`);
			return;
		}

		const overviewControls = document.getElementById('overview-controls') as HTMLDivElement;
		
		if (noteID == '.overview') {
			overviewControls.classList.add('show');
			this.persistentTextInput.readOnly = true;
			this.noteManager.updateOverview();
		} else {
			overviewControls.classList.remove('show');
			this.persistentTextInput.readOnly = false;
		}

		this.renderPersistentText(noteID);
		this.updateSaveStateDisplay();
		this.displayCurrentEntries();
	}

	private updateNoteTabsID(oldId: string, newId: string, newTitle: string): void {
		const noteRadio = document.getElementById(oldId) as HTMLInputElement;
		const noteLabel = document.querySelector(`label[for="${oldId}"]`) as HTMLLabelElement;

		noteRadio.id = newId;
		noteLabel.htmlFor = newId;
		noteLabel.textContent = newTitle.slice(0,this.noteManager.userSettings.maxTabTitleLength);

		this.updateSaveStateDisplay();
	}

	private displayNewEntry(newEntry: Entry): void {
		// const entries = this.noteManager.getCurrentEntries();

		if (!newEntry) return;

		let lastGroupDiv: HTMLDivElement | null = null;
		const existingGroups = Array.from(this.entriesContainer.querySelectorAll('.entry-content'));
		if (existingGroups.length > 0) {
			const lastGroup = existingGroups[existingGroups.length - 1] as HTMLDivElement;
			const lastGroupID = parseInt(lastGroup.dataset.groupID || '0');
			if (lastGroupID == newEntry.groupId) {
				lastGroupDiv = lastGroup as HTMLDivElement;
			}
		}

		let entryDiv: HTMLElement;
		if (lastGroupDiv) {
			entryDiv = lastGroupDiv;
		} else {
			entryDiv = document.createElement('div');
			entryDiv.classList.add('entry-content');

			const entryHeader = document.createElement('div');
			entryHeader.classList.add('entry-header');

			const headingBreak = document.createElement('hr');
			entryHeader.appendChild(headingBreak);

			const timestampSpan = document.createElement('span');
			timestampSpan.textContent = NoteUtils.formatDate(newEntry.created);
			entryHeader.appendChild(timestampSpan);

			entryDiv.appendChild(entryHeader);
			this.entriesContainer.appendChild(entryDiv);
		}

		const splitLines = newEntry.text.split('\n');
		let parents: HTMLDivElement[] = [];

		for (let i = 0; i < splitLines.length; i++) {
			const line = splitLines[i];
			const indentLevel = NoteUtils.countLeadingTabs(line, this.noteManager.userSettings.indentString);
			const text = NoteUtils.stripLeadingTabs(line, this.noteManager.userSettings.indentString);

			const entryTextDiv = document.createElement('div');
			entryTextDiv.classList.add('entry-text');

			let hasChildren = false;
			if (i < splitLines.length - 1) {
				const nextIndent = NoteUtils.countLeadingTabs(splitLines[i + 1], this.noteManager.userSettings.indentString);
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

		// Scroll to bottom or focus if needed
		entryDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
	}

	private displayCurrentEntries(): void {
		const entries = this.noteManager.getCurrentEntries();	
		if (entries.length == 0) return;
		this.entriesContainer.innerHTML = '';
		
		for (let i = 0; i < entries.length; i++) {
			const groupStartEntry = entries[i];
			const currentGroupId = groupStartEntry.groupId;

			let textContent = groupStartEntry.text;
			let nextIndex = i + 1;

			while (nextIndex < entries.length && entries[nextIndex].groupId == currentGroupId) {
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
			// TODO: Go through the entire group and get the most recently edited date, and use that
			timestampSpan.textContent = NoteUtils.formatDate(entries[i].created); // TODO: Relative/contextual/fuzzy time
			entryHeader.appendChild(timestampSpan);

			entryDiv.appendChild(entryHeader);

			const splitLines = textContent.split('\n');
			let parents: HTMLDivElement[] = [];

			for (let i = 0; i < splitLines.length; i++) {
				const line = splitLines[i];
				const indentLevel = NoteUtils.countLeadingTabs(line,this.noteManager.userSettings.indentString);
				const text = NoteUtils.stripLeadingTabs(line,this.noteManager.userSettings.indentString);

				const entryTextDiv = document.createElement('div');
				entryTextDiv.classList.add('entry-text');

				let hasChildren = false;
				if (i < splitLines.length - 1) {
					const nextIndent = NoteUtils.countLeadingTabs(splitLines[i + 1],this.noteManager.userSettings.indentString);
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

			this.entriesContainer.appendChild(entryDiv);

			i = nextIndex;
		}
	}

	private renderPersistentText(noteID: string): void {
		const textContent = this.noteManager.getPersistentText(noteID);
		this.persistentTextInput.value = textContent;
	}

	private updateSaveStateDisplay(noteID?: string): void { // If no noteID is given, defaults to the active note.
		const noteData = this.noteManager.getNoteData(noteID);
		if (!noteData) return; //TODO

		if (noteID == this.noteManager.getActiveNoteID()) this.updateTitleDisplay(noteData.id, noteData.title, noteData.isUnsaved);
		this.updateNoteLabelDisplay(noteData.id, noteData.title, noteData.isUnsaved);
	}

	private updateNoteLabelDisplay(noteID: string, noteTitle: string, isUnsaved: boolean): void {
		const noteLabelElement = document.querySelector(`label[for="${noteID}"]`) as HTMLLabelElement;
		if (noteID != '.overview') noteLabelElement.textContent = (isUnsaved ? '* ' : '') + (noteTitle).slice(0,this.noteManager.userSettings.maxTabTitleLength);
		if (noteTitle.length > this.noteManager.userSettings.maxTabTitleLength) noteLabelElement.textContent += '...';
	}

	private updateTitleDisplay(noteID: string, noteTitle: string, isUnsaved: boolean): void {
		const noteTitleElement = document.getElementById('note-title') as HTMLInputElement;
		noteTitleElement.value = (isUnsaved ? '* ' : '') + noteTitle;
	}

	private insertNewLine(): void {
		const lines = this.logInput.value.split('\n');
		const currentLine = lines[lines.length - 1];
		this.currentIndentationLevel = NoteUtils.countLeadingTabs(currentLine, this.noteManager.userSettings.indentString);

		const newLine = '\n' + this.noteManager.userSettings.indentString.repeat(this.currentIndentationLevel);
		this.logInput.value += newLine;

		this.updateLogInputHeight();
	}

	private updateLogInputHeight(): void {
		this.logInput.style.height = '0px';
		this.logInput.style.height = this.logInput.scrollHeight + 'px';
	}
}