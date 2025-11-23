import { getCurrentWindow } from '@tauri-apps/api/window';
import { Entry } from './entry';
import { Note } from './note';
import { NoteUtils } from './note-utils';
import { Overview } from './overview';
import { ToastManager } from './toast-manager';
import { NoteSelector } from './note-selector';

const CONFIG_FILENAME = 'config';

class Manager {
	private unopenedNotes: string[] = [];
	private openNotes: string[] = [];
	private notes: Note[] = [];
	private overview: Overview;
	private activeNoteIndex: number;
	private userSettings: UserSettings = {
		indentString: '\t',
		groupInterval: 5, // minutes
		noteIndexFileName: '.note-headings',
		cacheFileName: 'session',
		toastDuration: 3000, // ms
		dragHandleWidth: 20, // px
		maxTabTitleLength: 30, // chars
		restoreTextPreviewLength: 50, // chars
	};
	private cachedData: SessionData;
	private noteTabsContainer: HTMLDivElement;
	private logInput: HTMLTextAreaElement;
	private persistentTextInput: HTMLTextAreaElement;
	private currentIndentationLevel: number = 0;
	private toastManager: ToastManager;

	private draggedTab: HTMLDivElement | null = null;
	private noteSelector: NoteSelector

	public constructor() {
		this.activeNoteIndex = 0;

		this.noteTabsContainer = document.getElementById('note-tabs') as HTMLDivElement;
		this.logInput = document.getElementById('log-input') as HTMLTextAreaElement;
		this.persistentTextInput = document.getElementById('persistent-text-input') as HTMLTextAreaElement;

		this.toastManager = new ToastManager(this.userSettings.toastDuration);
		this.noteSelector = new NoteSelector((noteId) => {
			this.openNote(noteId);
		});
	}

	public async initialiseAsync(): Promise<void> {
		await this.loadUserSettings();
		await this.initialiseNotes();
		await this.initialiseOverview();
		await this.updateOverview();
		await this.initialiseInput();
		await this.initialiseCloseHandler();
		await this.restorePreviousSession();

		for (const note of this.notes) {
			console.log(`${note.id} : ${note.isUnsaved()}`)
		}
	}

	private async loadUserSettings(): Promise<void> {
		if (await NoteUtils.doesConfigExist(CONFIG_FILENAME)) {
			const configText = await NoteUtils.readConfig(CONFIG_FILENAME);
			const configParsed = JSON.parse(configText) as Partial<UserSettings>;

			this.userSettings = {...this.userSettings, ...configParsed };
		}
	}

	private async initialiseNotes(): Promise<void> {

		// TODO: Load a note from the dang cache
		// Also the overview is in Notes
		this.noteTabsContainer.innerHTML = '';
		await this.loadAllNotes(); 
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
			if (this.draggedTab) return;
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == 's') {
				e.preventDefault();
				this.saveNotes(e.shiftKey); // Saves all notes on Ctrl + Shift + S, and just the active one on Ctrl + S
			} else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { // Ctrl + N to make a new note
				e.preventDefault();
				this.addNewNote(`Untitled ${this.notes.length}`);
				this.setCurrentNote(this.notes[this.notes.length - 1].id);
			} else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == 'o') { // Ctrl + O to open a note
				this.noteSelector.showModal(this.unopenedNotes);
			} else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == 'w') { // Ctrl + W to close a note
				this.closeCurrentNote();
			} else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == 'q') { // Ctrl + Q to quick save to cache
				this.writeToCache();
	
			}
			
		});

		this.persistentTextInput.addEventListener('keyup', (_e) => {
			if (this.draggedTab) return;
			this.updatePersistentText();
		});
				
		const sidebar = document.getElementById('sidebar') as HTMLFormElement;
		sidebar.addEventListener('click', (e) => {
			if (this.draggedTab) return;
			const target = e.target as HTMLElement;
			if (target.className == 'tab-input') {
				this.setCurrentNote(target.id);
			}

		});

		this.noteTabsContainer.addEventListener('mousedown', (e) => {
			if (e.clientX > this.userSettings.dragHandleWidth) return;
			
			const targetTab: HTMLDivElement = (e.target as HTMLElement).closest('.tab');
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

	private async initialiseCloseHandler(): Promise<void> {
		const appWindow = await getCurrentWindow();
		await appWindow.onCloseRequested(async (e) => {
			e.preventDefault();
			if (this.isAnythingUnsaved) {
				const ok = await confirm('Close without saving?');
				if (!ok) return;
			}
			try {
				await this.writeToCache();
				await window.close();
			} catch (err) {
				console.error('Could not save before closing', err);
				await window.close();
			}
		});
	}

	private async restorePreviousSession(): Promise<void> {
		this.cachedData = {
			currentNoteId: this.notes[this.activeNoteIndex] ? this.notes[this.activeNoteIndex].id : '.overview',
			unsavedEntries: {},
			unsavedPersistentText: {},
			openNotes: [],
		}
		
		if (await NoteUtils.doesCacheExist(this.userSettings.cacheFileName)) {
			const cacheText = await NoteUtils.readCache(this.userSettings.cacheFileName);
			const cacheParsed = JSON.parse(cacheText) as Partial<SessionData>;
			this.cachedData = { ...this.cachedData, ...cacheParsed };
			this.toastManager.show('info','Session restored');
		} else {
			this.toastManager.show('warn','No previous session found');
		}
		for (const openNoteId of this.cachedData.openNotes) {
			this.openNote(openNoteId);
			if (openNoteId == this.cachedData.currentNoteId) this.selectNote(openNoteId);
			this.updateNoteSaveState(openNoteId);
		}
		for (const noteId in this.cachedData.unsavedPersistentText) {
			const unsavedText = this.cachedData.unsavedPersistentText[noteId];
			const noteIndex = this.notes.findIndex(note => note.id === noteId);
			if (!(!unsavedText || unsavedText == this.notes[noteIndex].getPersistentTextContent())) {
				const result = await confirm(`Restore unsaved text: ...${unsavedText.slice(unsavedText.length - this.userSettings.restoreTextPreviewLength)} for ${noteId}?`);
				if (result) { // TODO: Add setting to autorestore
					
					this.notes[noteIndex].updatePersistentTextContent(unsavedText); // FIXME
				} else {
					this.cachedData.unsavedPersistentText[noteId] = '';
				}
			} else {
				this.notes[noteIndex].updateSavedPersistentTextContent(this.notes[noteIndex].getPersistentTextContent()); // ???
			}
		}
	}

	private displayCurrentEntries(): void {
		if (this.activeNoteIndex == null) return; // TODO
		
		this.updateNoteSaveState(this.notes[this.activeNoteIndex].id);

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
			// TODO: Go through the entire group and get the most recently edited date, and use that
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
			this.persistentTextInput.readOnly = false;
		}
		
		this.activeNoteIndex = this.notes.findIndex(note => note.id === noteId);

		if (!this.notes[this.activeNoteIndex]) return; // TODO
		this.cachedData.currentNoteId = noteId;
		this.updateNoteSaveState(noteId);

		if (this.activeNoteIndex == 0) {
			overviewControls.classList.add('show');
			this.updateOverview();
			this.persistentTextInput.value = ''; // TODO: Display persistent text for overview
			this.persistentTextInput.readOnly = true;
		} else {
			this.persistentTextInput.value = this.notes[this.activeNoteIndex].getPersistentTextContent();
		}

		this.displayCurrentEntries();
	}

	private addNewNote(noteTitle: string): Note { // TODO: make sure there is enough space for the note?
		const newNote = new Note(noteTitle);
		this.notes.push(newNote);
		this.unopenedNotes.push(newNote.id);
		this.activeNoteIndex = this.notes.length - 1;

		this.openNote(newNote.id);
		this.selectNote(newNote.id);
		return newNote;
	}

	private updateNoteSaveState(noteId: string): void {
		const noteIndex = this.notes.findIndex(note => note.id === noteId);
		if (!this.notes[noteIndex]) return;

		const isUnsaved = this.notes[noteIndex].isUnsaved();
		const noteTitle = document.getElementById('note-title') as HTMLInputElement
		const noteLabel = document.querySelector(`label[for="${noteId}"]`);
		
		noteTitle.value = (isUnsaved ? '* ' : '') + this.notes[noteIndex].title;
		
		if (noteIndex > 0) noteLabel.textContent = (isUnsaved ? '* ' : '') + (this.notes[noteIndex].title).slice(0,this.userSettings.maxTabTitleLength);
		if (this.notes[noteIndex].title.length > this.userSettings.maxTabTitleLength) noteLabel.textContent += '...';
		if (isUnsaved) {
			this.cachedData.unsavedPersistentText[noteId] = this.notes[noteIndex].getPersistentTextContent();
		} else {
			this.cachedData.unsavedPersistentText[noteId] = '';
		}
	}

	private isAnythingUnsaved(): boolean {
		let result = false;
		for (const note of this.notes) {
			if (note.isUnsaved()) {
				result = true;
				break;
			}
		}
		return result;
	}

	private addNoteElements(note: Note): void {
		const noteTabDiv = document.createElement('div');
		noteTabDiv.classList.add('tab');

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
		
		this.logInput.focus();
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
		this.updateNoteSaveState(this.notes[this.activeNoteIndex].id);
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

		if (!this.cachedData.unsavedEntries[note.id]) this.cachedData.unsavedEntries[note.id] = [];
		this.cachedData.unsavedEntries[note.id].push(newEntry);

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
					if (newNote) {
						this.notes.push(newNote);
						notesAdded.push(newNote.id);
					} else {
						this.toastManager.show('error',`Could not load note ${noteId}`);
					}
				}
			}
			if (notesAdded.length > 0) {
				this.unopenedNotes = notesAdded;
				this.toastManager.show('info',`Loaded all notes from ${this.userSettings.noteIndexFileName}.md`);
			} else {
				this.setCurrentNote('.overview');
			}
		} else { 
			this.toastManager.show('error',`Could not find headings file ${this.userSettings.noteIndexFileName}.md`);
			this.setCurrentNote('.overview');
		}
	}

	public openNote(noteId: string): void {
		if (this.unopenedNotes.includes(noteId)) {
			const unopenedNotesIndex = this.unopenedNotes.indexOf(noteId);
			this.unopenedNotes.splice(unopenedNotesIndex, 1);
			this.openNotes.push(noteId);

			const noteIndex = this.notes.findIndex(note => note.id === noteId);
			const note = this.notes[noteIndex];
			this.addNoteElements(note);
		} else {
			this.toastManager.show('error',`Could not find note with id ${noteId}`);
		}
	}

	private selectNote(noteId: string): void {
		const noteTab = document.getElementById(noteId) as HTMLInputElement;
		noteTab.checked = true;
		this.setCurrentNote(noteId);
	}

	private closeCurrentNote(): void {
		const noteId = this.notes[this.activeNoteIndex].id;
		const openNotesIndex = this.openNotes.indexOf(noteId);
		this.openNotes.splice(openNotesIndex, 1);
		this.unopenedNotes.push(noteId);

		const radioElement = document.getElementById(noteId);
		const noteTabDiv = radioElement.parentElement as HTMLDivElement;
		noteTabDiv.remove();

		const newNoteId = this.openNotes[this.openNotes.length - 1] || '.overview';
		this.setCurrentNote(newNoteId);
		this.selectNote(newNoteId);
	}

	private isNoteIdValid(noteId: string): boolean {
		return (this.openNotes.includes(noteId) || this.unopenedNotes.includes(noteId));
	}

	private async writeToCache(): Promise<void> {
		this.cachedData.currentNoteId = this.notes[this.activeNoteIndex].id;
		this.cachedData.openNotes = this.openNotes;
		
		for (const noteId in this.cachedData.unsavedEntries) {
			if (!this.isNoteIdValid(noteId)) {
				delete this.cachedData.unsavedEntries[noteId];
			}
		}

		for (const noteId in this.cachedData.unsavedPersistentText) {
			if (!this.isNoteIdValid(noteId)) {
				delete this.cachedData.unsavedPersistentText[noteId];
			}
		}

		await NoteUtils.writeCache(this.userSettings.cacheFileName, JSON.stringify(this.cachedData, null, 2));
	}

	private async saveNotes(saveAll: boolean = false): Promise<void> {
		this.updatePersistentText();
		if (!(saveAll || this.notes[this.activeNoteIndex].isUnsaved())) return;
		let wasSaveSuccessful = false;
		for (let i = 0; i < this.notes.length; i++) {
			const note = this.notes[i];
			const currentId = note.id;
			if (saveAll || currentId == this.notes[this.activeNoteIndex].id) {
				const result = await note.save();
				if (result) {
					wasSaveSuccessful = true;
					if (note.id != currentId) {
						this.openNotes[this.openNotes.indexOf(currentId)] = note.id;
						this.updateNoteTabsId(currentId, note.id, note.title);
						if (!saveAll) this.toastManager.show('info',`Saved as ${this.notes[this.activeNoteIndex].id}.md`);
				
					}
					if (currentId in this.cachedData.unsavedEntries) {
						delete this.cachedData.unsavedEntries[currentId];
					}

					if (currentId in this.cachedData.unsavedPersistentText) {
						delete this.cachedData.unsavedPersistentText[currentId];
					}
					this.updateNoteSaveState(note.id);
					this.cachedData.unsavedEntries[note.id] = [];
					this.cachedData.unsavedPersistentText[note.id] = '';
				}
				
			}
		}
		const noteHeadings = this.openNotes.join('\n') + ('\n') + this.unopenedNotes.join('\n');
		await NoteUtils.writeMarkdownFile(this.userSettings.noteIndexFileName,noteHeadings);
		await this.writeToCache();
		if (saveAll && wasSaveSuccessful) this.toastManager.show('info','Saved all notes');
	}

	private updateNoteTitle(newTitle: string): void {
		const oldId = this.notes[this.activeNoteIndex].id;
		this.notes[this.activeNoteIndex].updateTitle(newTitle);
		this.updateNoteTabsId(oldId, this.notes[this.activeNoteIndex].id, newTitle);
	}

	private updateNoteTabsId(oldId: string, newId: string, newTitle: string): void {
		const noteRadio = document.getElementById(oldId) as HTMLInputElement;
		const noteLabel = document.querySelector(`label[for="${oldId}"]`) as HTMLLabelElement;

		noteRadio.id = newId;
		noteLabel.htmlFor = newId;
		noteLabel.textContent = newTitle.slice(0,this.userSettings.maxTabTitleLength);
	}
	
	private countLeadingTabs(line: string): number {
		return line.match(new RegExp(`^${this.userSettings.indentString}+`))?.[0].length || 0;

	}

	private stripLeadingTabs(line: string): string {
		return line.replace(new RegExp(`^${this.userSettings.indentString}+`), '');
	}
}

interface SessionData {
	currentNoteId: string;
	unsavedEntries: Record<string, Entry[]>;
	unsavedPersistentText: Record<string, string>;
	openNotes: string[];
	// TODO: Also save:
		// Expanded or collapsed hierarchies
		// Scroll position
		// Cursor position in notepad
}

type UserSettings = {
	indentString: string;
	groupInterval: number;
	noteIndexFileName: string;
	cacheFileName: string;
	toastDuration: number;
	dragHandleWidth: number;
	maxTabTitleLength: number;
	restoreTextPreviewLength: number;
};

const manager = new Manager();
manager.initialiseAsync();