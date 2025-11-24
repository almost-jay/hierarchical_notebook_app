import { Entry } from './entry';
import { Note } from './note';
import { NoteUtils } from './note-utils';
import { Overview } from './overview';

const CONFIG_FILENAME = 'config';

export class NoteManager {
	public notes: Map<string, Note>;
	public overview: Overview;
	private activeNoteId: string = '.overview';
	private openNotes: Set<string>; //openNotes ∩ unopenedNotes = ∅ 
	private unopenedNotes: Set<string>; 
	private cachedData: SessionData;
	public userSettings: UserSettings = {
		indentString: '\t',
		groupInterval: 5, // minutes
		noteIndexFileName: '.note-headings',
		cacheFileName: 'session',
		toastDuration: 3000, // ms
		dragHandleWidth: 20, // px
		maxTabTitleLength: 30, // chars
		restoreTextPreviewLength: 50, // chars
	};

	public constructor() {
		this.notes =  new Map();
		this.overview = new Overview();
		this.notes.set('.overview', this.overview);
		this.openNotes = new Set();
		this.unopenedNotes = new Set();
		
		this.cachedData = {
			currentNoteId: this.notes.get(this.activeNoteId) ? this.activeNoteId : '.overview',
			unsavedEntries: {},
			unsavedPersistentText: {},
			openNotes: [],
		};
	}

	/**
	 * @todo TRY/CATCH FOR THIS ONE
	 */
	public async loadAllNotes(): Promise<{ id: string, title: string }[]> {

		const notesAdded = [];
		const noteHeadingsFileName = this.userSettings.noteIndexFileName;
		if (await NoteUtils.doesFileExist(noteHeadingsFileName+'.md')) {
			const noteIDList: string[] = (await NoteUtils.getMarkdownFile(noteHeadingsFileName)).split('\n');
			for (const noteID of noteIDList) {
				if (noteID == '') continue;
				
				if (noteID == '.overview') {
					const newOverview: Overview = await Overview.loadFromFile();
					this.overview = newOverview;
					this.notes.set('.overview', this.overview);
					if (!newOverview) throw new Error('Could not load Overview!');
				} else {
					const newNote = await Note.loadFromFile(noteID);
					if (newNote) {
						this.addNewNote(newNote);
						notesAdded.push({ id: noteID, title: newNote.title });
					} else {
						throw new Error(`Could not load note with ID: "${noteID}"!`);
					}
				}
			}
			if (notesAdded.length == 0) {
				this.changeCurrentNote('.overview');
			}
		} else {
			this.changeCurrentNote('.overview');
		}
		return notesAdded;
	}

	/**
	 * 
	 * @returns { { id: string, title: string }[]} A list of note IDs that need to be opened!
	 */
	public async restorePreviousSession(): Promise< { id: string, title: string }[]> {
		if (! (await NoteUtils.doesCacheExist(this.userSettings.cacheFileName))) return [];

		const cacheText = await NoteUtils.readCache(this.userSettings.cacheFileName);
		const cacheParsed = JSON.parse(cacheText) as Partial<SessionData>;

		const results: { id: string, title: string }[] = [];
		this.cachedData = { ...this.cachedData, ...cacheParsed };

		for (const noteID in this.cachedData.unsavedPersistentText) {
			const unsavedText = this.cachedData.unsavedPersistentText[noteID];
			if (!(!unsavedText || unsavedText == this.notes.get(noteID).getPersistentTextContent())) {
				const result = await confirm(`Restore unsaved text: ...${unsavedText.slice(unsavedText.length - this.userSettings.restoreTextPreviewLength)} for ${noteID}?`);
				if (result) { // TODO: Add setting to autorestore
					
					this.notes.get(noteID).updatePersistentTextContent(unsavedText); // FIXME
				} else {
					this.cachedData.unsavedPersistentText[noteID] = '';
				}
			} else {
				this.notes.get(noteID).updateSavedPersistentTextContent(this.notes.get(noteID).getPersistentTextContent()); // ???
			}
		}

		for (const noteID of this.cachedData.openNotes) {
			const result = this.openNoteData(noteID);
			if (result == null) {
				throw new Error(`Could not open: ${noteID}`);
			} else {
				results.push(result);
			}
		}

		return results;
	}

	public async loadUserSettings(): Promise<void> {
		if (await NoteUtils.doesConfigExist(CONFIG_FILENAME)) {
			const configText = await NoteUtils.readConfig(CONFIG_FILENAME);
			const configParsed = JSON.parse(configText) as Partial<UserSettings>;

			this.userSettings = {...this.userSettings, ...configParsed };
		}
	}

	public createNewNote(noteTitle?: string): string {
		noteTitle = noteTitle || `Untitled ${this.notes.size}`;
		const newNote = new Note(noteTitle);
		this.addNewNote(newNote);
		return newNote.id;
	}

	private addNewNote(newNote: Note): void {
		this.notes.set(newNote.id, newNote);
		this.unopenedNotes.add(newNote.id);
	}

	/** 
	 * YOU NEED TO CALL updatePersistentText before you call this!
	 * if the returned string is == .overview:
	 * overviewControls.classList.add('show')
	 * persistenttextinput.value = '' TODO
	 * persistenttextinput.readonly = true
	 * updateOverview()
	 * ELSE
	 * do the opposite of allat
	 * also set persistenttextinput.value as needed
	 * You also need to: if 
	 * @param noteID the ID of the note to attempt to change to
	 * @returns a string/null containing the ID of the current note
	 */
	public changeCurrentNote(noteID: string): string | null {
		// Same logic as setCurrentNote minus the dom shit
		// logic inside the tab click handlers?
		// Fires onActiveNoteChanged(noteID)

		if (!this.notes.has(noteID)) return null;

		this.activeNoteId = noteID;
		this.cachedData.currentNoteId = noteID;

		return noteID;
	}

	public updateOverview(): void {
		const allEntries = [];
		this.overview.clearEntries();
		for (const note of this.notes.values()) {
			allEntries.push(...note.entries.map(entry => ({ entry: entry, sourceNoteId: note.id })));  // Deliberately using .entries instead of getOwnEntries here
		}
		this.overview.updateEntries(allEntries);
	}

	/**
	 * @todo use try/catch
	 */
	public openNoteData(noteID: string): { id: string, title: string } | null {
		// UIManager will do all the dom stuff

		// Move ID from unopened to openNotes
		// Update internal metadata

		if (!this.unopenedNotes.has(noteID)) throw new Error(`Could not find note with id ${noteID} to open it`);

		this.unopenedNotes.delete(noteID);
		this.openNotes.add(noteID);

		const note = this.notes.get(noteID);
		if (!note) return null;

		return { id: noteID, title: note.title };
	}

	/**
	 * @todo Use a try/catch; also remember to select the returned note in DOM
	 */
	public closeCurrentNote(): string {
		// Remove note from openNotes and select fallback active note
		// Basically the same but without the DOM shit

		if (!this.openNotes.has(this.activeNoteId)) throw new Error(`Could not find note with id ${this.activeNoteId} to close it`);

		this.openNotes.delete(this.activeNoteId);
		this.unopenedNotes.add(this.activeNoteId);

		const openNotesAsArray = Array.from(this.openNotes);
		const newNoteId = openNotesAsArray[openNotesAsArray.length - 1] || '.overview';
		this.changeCurrentNote(newNoteId);

		return newNoteId;
	}

	/**
	 * Call updatePersistentText() before this
	 * @returns 
	 */
	public async saveAllNotes(): Promise<{ success: boolean; oldID: string; newID: string; newTitle: string }[]> {
		const results: { success: boolean, oldID: string, newID: string; newTitle: string }[] = [];

		for (const note of this.notes.values()) {
			const currentId = note.id; // this is a bit of a misnomer because current ≠ up to date
			const result = await this.saveNote(currentId);
			results.push(result);
		}
		this.saveMetadata();
		return results;
	}

	/**
	 * You gotta call updatePersistentText() with this
	 * @param noteID 
	 * @returns 
	 */
	public async saveNote(noteID: string): Promise<{ success: boolean, oldID: string, newID: string, newTitle: string }> {
		const note = this.notes.get(noteID);
		if (!note) return { success: false, oldID: noteID, newID: noteID, newTitle: '' };

		const oldID = noteID;
		const result = await note.save();
		const newID = note.id;

		if (oldID != newID) { // Possible duplicate logic for this.updateNoteTitle?
			this.notes.delete(oldID);
			this.notes.set(newID, note);

			if (this.openNotes.has(oldID)) {
				this.openNotes.delete(oldID);
				this.openNotes.add(newID);
			}
			if (this.unopenedNotes.has(oldID)) {
				this.unopenedNotes.delete(oldID);
				this.unopenedNotes.add(newID);
			}
		}

		return { success: result, oldID, newID, newTitle: note.title };
	}

	public async saveMetadata(): Promise<void> {
		const noteHeadings = Array.from(this.openNotes).join('\n') + '\n' + Array.from(this.unopenedNotes).join('\n');
		await NoteUtils.writeMarkdownFile(this.userSettings.noteIndexFileName,noteHeadings);
		await this.writeToCache();
	}
	/**
	 * 
	 * @param newTitle 
	 * @returns the new ID and title
	 */
	public updateNoteTitle(oldID: string, rawNewTitle: string): { oldID: string, newID: string, newTitle: string } | null {
		// Old logic
		// Validate title
		// Update note.title
		// Mark if unsaved
		const note = this.notes.get(oldID);
		if (!note) return null;
		note.updateTitle(rawNewTitle);
		const newID = note.id;
		const newTitle = note.title;

		this.notes.delete(oldID);
		this.notes.set(newID, note);

		if (this.openNotes.has(oldID)) {
			this.openNotes.delete(oldID);
			this.openNotes.add(newID);
		}
		if (this.unopenedNotes.has(oldID)) {
			this.unopenedNotes.delete(oldID);
			this.unopenedNotes.add(newID);
		}

		return { oldID, newID, newTitle };
	}

	/**
	 * 
	 * @param newText 
	 * @param noteID 
	 * @returns true if the save state changed
	 */
	public updatePersistentText(newText: string, noteID?: string): boolean {
		// Update note.persistentText
		// Trigger cache update callback
		// Notify UI that note's unsaved state changed
		noteID = noteID || this.activeNoteId;
		const note = this.notes.get(noteID);
		if (!note) return false;
		
		const wasUnsaved = note.isUnsaved();

		note.updatePersistentTextContent(newText);
		
		const isUnsavedNow = note.isUnsaved();

		if (note.isUnsaved()) {
			this.cachedData.unsavedPersistentText[noteID] = newText;
			this.writeToCache();
		} else if (noteID in this.cachedData.unsavedPersistentText) {
			delete this.cachedData.unsavedPersistentText[noteID];
			this.writeToCache();
		}

		return wasUnsaved != isUnsavedNow;
	}

	public getActiveNoteID(): string {
		return this.activeNoteId;
	}

	public getNoteData(noteID?: string): { id: string, title: string, isUnsaved: boolean } | null {
		noteID = noteID || this.activeNoteId;
		const note = this.notes.get(noteID);
		if (!note) return null;
		return { id: noteID, title: note.title, isUnsaved: note.isUnsaved() }; 
	}

	public getPersistentText(noteID?: string): string {
		noteID = noteID || this.activeNoteId;
		const note = this.notes.get(noteID);
		if (!note) return ''; // TODO

		return note.getPersistentTextContent();
	}

	public getCurrentEntries(): Entry[] {
		const note = this.notes.get(this.activeNoteId);
		if (!note) return [];

		return note.getOwnEntries();
	}

	public getUnopenedNotes(): string[] {
		return Array.from(this.unopenedNotes);
	}

	/** 
	 * UIManager: Take the newEntry passed back and add it to the DOM
	*/
	public submitEntry(entryText: string, currentTime: Date): Entry | null {
		// UI will supply raw text and current time
		// Append entry, mark note unsaved, trigger re-render callback
		if (entryText.trim().length == 0) return null;

		const note = this.notes.get(this.activeNoteId);
		if (!note) return null;
		
		// If the time elapsed between (now) and when the previous entry was created is over a certain threshold, the entry will not be displayed in the same group.
		// This is mostly a visual effect, but pre-calculating it now saves the renderer from having to do it.
		const entries = note?.getOwnEntries();
		let groupID = 0;

		if (entries.length > 0) {
			groupID = entries[entries.length - 1].groupId;
			const previousEntryCreated = entries[entries.length - 1].created;
			const timeSincePreviousEntry = currentTime.getTime() - previousEntryCreated.getTime();
			if (timeSincePreviousEntry / 60000 > this.userSettings.groupInterval) {
				groupID++;
			}
		}

		const splitLines = entryText.split('\n');
		const indentLevel = NoteUtils.countLeadingTabs(splitLines[splitLines.length - 1], this.userSettings.indentString);
		const newEntry = new Entry(entries ? entries.length : 0, groupID, entryText, currentTime, indentLevel);
		note.addEntry(newEntry);

		if (!this.cachedData.unsavedEntries[note.id]) this.cachedData.unsavedEntries[note.id] = [];
		this.cachedData.unsavedEntries[note.id].push(newEntry);

		return newEntry;
	}


	private isAnythingUnsaved(): boolean {
		for (const note of this.notes.values()) {
			if (note.isUnsaved()) {
				return true;
			}
		}
		return false;
	}

	private isNoteIDValid(noteID: string): boolean {
		return (this.openNotes.has(noteID) || this.unopenedNotes.has(noteID));
	}

	public async writeToCache(): Promise<void> {
		this.cachedData.currentNoteId = this.activeNoteId;
		this.cachedData.openNotes = Array.from(this.openNotes);

		for (const noteId in this.cachedData.unsavedEntries) {
			if (!this.isNoteIDValid(noteId)) {
				delete this.cachedData.unsavedEntries[noteId];
			}
		}

		for (const noteId in this.cachedData.unsavedPersistentText) {
			if (!this.isNoteIDValid(noteId)) {
				delete this.cachedData.unsavedPersistentText[noteId];
			}
		}

		await NoteUtils.writeCache(this.userSettings.cacheFileName, JSON.stringify(this.cachedData, null, 2));
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
