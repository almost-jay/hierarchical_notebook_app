import { Entry } from './entry';
import { Note } from './note';
import { NoteUtils } from './note-utils';
import { Overview } from './overview';

const CONFIG_FILENAME = 'config';

export class NoteManager {
	public notes: Map<string, Note>;
	public overview: Overview;
	private activenoteID: string = '.overview';
	private openNotes: string[]; //openNotes ∩ unopenedNotes = ∅ 
	private unopenedNotes: string[]; 
	private cachedData: SessionData;
	public userSettings: UserSettings = {
		indentString: '\t',
		groupInterval: 5, // minutes
		noteIndexFileName: '.note-headings',
		cacheFileName: 'session',
		toastDuration: 3000, // ms
		dragHandleWidth: 20, // px
		maxTabTitleLength: 30, // chars
		restoreTextPreviewLength: 500, // chars
	};

	public constructor() {
		this.notes =  new Map();
		this.overview = new Overview();
		this.notes.set('.overview', this.overview);
		this.openNotes = [];
		this.unopenedNotes = [];
		
		this.cachedData = {
			currentnoteID: this.notes.get(this.activenoteID) ? this.activenoteID : '.overview',
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

		for (const noteID of this.cachedData.openNotes) {
			if (this.isnoteIDValid(noteID)) {
				const result = this.openNoteData(noteID);
				if (result == null) {
					throw new Error(`Could not open: ${noteID}`);
				} else {
					results.push(result);
				}
			}
		}

		this.activenoteID = this.notes.has(this.cachedData.currentnoteID) ? this.cachedData.currentnoteID : '.overview';
		await this.writeToCache();
		return results;
	}

	public async loadUserSettings(): Promise<void> {
		if (await NoteUtils.doesConfigExist(CONFIG_FILENAME)) {
			const configText = await NoteUtils.readConfig(CONFIG_FILENAME);
			const configParsed = JSON.parse(configText) as Partial<UserSettings>;

			this.userSettings = {...this.userSettings, ...configParsed };
		}
	}

	public createNewNote(noteTitle?: string): string { // Used to actually create a note
		noteTitle = noteTitle || `Untitled ${this.notes.size}`;
		const newNote = new Note(noteTitle);
		this.addNewNote(newNote);
		this.writeToCache();
		return newNote.id;
	}

	private addNewNote(newNote: Note): void { // Used to add a note's data to its list
		this.notes.set(newNote.id, newNote);
		this.unopenedNotes.push(newNote.id);
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
		if (!this.notes.has(noteID)) return null;

		this.activenoteID = noteID;
		this.cachedData.currentnoteID = noteID;

		return noteID;
	}

	public updateOverview(): void {
		const allEntries = [];
		this.overview.clearEntries();
		for (const note of this.notes.values()) {
			allEntries.push(...note.entries.map(entry => ({ entry: entry, sourcenoteID: note.id })));  // Deliberately using .entries instead of getOwnEntries here
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

		if (!this.unopenedNotes.includes(noteID)) throw new Error(`Could not find note with id ${noteID} to open it`);

		this.unopenedNotes.splice(this.unopenedNotes.indexOf(noteID), 1);
		this.openNotes.push(noteID);

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

		if (!this.openNotes.includes(this.activenoteID)) throw new Error(`Could not find note with id ${this.activenoteID} to close it`);

		this.openNotes.splice(this.openNotes.indexOf(this.activenoteID), 1);
		this.unopenedNotes.push(this.activenoteID);

		const openNotesAsArray = Array.from(this.openNotes);
		const newnoteID = openNotesAsArray[openNotesAsArray.length - 1] || '.overview';
		this.changeCurrentNote(newnoteID);

		return newnoteID;
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

		if (oldID != newID) {
			this.notes.delete(oldID);
			this.notes.set(newID, note);

			if (this.openNotes.includes(oldID)) {
				this.openNotes.splice(this.openNotes.indexOf(oldID), 1);
				this.openNotes.push(newID);
			}
			if (this.unopenedNotes.includes(oldID)) {
				this.unopenedNotes.splice(this.unopenedNotes.indexOf(oldID), 1);
				this.unopenedNotes.push(newID);
			}
		}

		return { success: result, oldID, newID, newTitle: note.title };
	}

	public async saveMetadata(): Promise<void> {
		const noteHeadings = Array.from(this.openNotes).join('\n') + '\n' + Array.from(this.unopenedNotes).join('\n') + '\n.overview';
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

		if (this.openNotes.includes(oldID)) {
			this.openNotes.splice(this.openNotes.indexOf(oldID), 1);
			this.openNotes.push(newID);
		}
		if (this.unopenedNotes.includes(oldID)) {
			this.unopenedNotes.splice(this.unopenedNotes.indexOf(oldID), 1);
			this.unopenedNotes.push(newID);
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
		noteID = noteID || this.activenoteID;
		const note = this.notes.get(noteID);
		if (!note) return false;
		
		const wasUnsaved = note.isUnsaved();
		note.updatePersistentTextContent(newText);

		const isUnsavedNow = note.isUnsaved();

		// if (note.isUnsaved()) {
		// 	this.cachedData.unsavedPersistentText[noteID] = newText;
		// } else if (noteID in this.cachedData.unsavedPersistentText) {
		// 	delete this.cachedData.unsavedPersistentText[noteID];
		// }

		// this.writeToCache();
		
		return wasUnsaved != isUnsavedNow;
	}

	public editEntry(entryID: number): void {
		const note = this.notes.get(this.activenoteID);
		if (!note) return;

		const targetEntry = note.getOwnEntries()[entryID];
		if (!targetEntry) console.log ('fail to find entry: '+entryID); return;

		
	}

	public getActivenoteID(): string {
		return this.activenoteID;
	}

	public getNoteData(noteID?: string): { id: string, title: string, isUnsaved: boolean } | null {
		noteID = noteID || this.activenoteID;
		const note = this.notes.get(noteID);
		if (!note) return null;
		return { id: noteID, title: note.title, isUnsaved: note.isUnsaved() }; 
	}

	public getPersistentText(noteID?: string): string {
		noteID = noteID || this.activenoteID;
		const note = this.notes.get(noteID);
		if (!note) return ''; // TODO

		return note.getPersistentTextContent();
	}

	public getCurrentEntries(): Entry[] {
		const note = this.notes.get(this.activenoteID);
		if (!note) return [];
		return note.entries; // deliberately .entries and not .getOwnEntries()
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

		const note = this.notes.get(this.activenoteID);
		if (!note) return null;
		
		// If the time elapsed between (now) and when the previous entry was created is over a certain threshold, the entry will not be displayed in the same group.
		// This is mostly a visual effect, but pre-calculating it now saves the renderer from having to do it.
		const splitLines = entryText.split('\n');
		const indentLevel = NoteUtils.countLeadingTabs(splitLines[splitLines.length - 1], this.userSettings.indentString);
		const newEntry = note.createNewEntry(entryText, currentTime, indentLevel, this.userSettings.groupInterval);

		// if (!this.cachedData.unsavedEntries[note.id]) this.cachedData.unsavedEntries[note.id] = [];
		// this.cachedData.unsavedEntries[note.id].push(newEntry);

		if (this.activenoteID == '.overview') {
			this.updateOverview();
		}
		this.writeToCache();
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

	public reorderOpenNotes(noteID: string, newIndex: number): void {
		if (newIndex > this.openNotes.length) return;
		if (!this.openNotes.includes(noteID)) return;

		this.openNotes.splice(this.openNotes.indexOf(noteID), 1);
		this.openNotes.splice(newIndex, 0, noteID);
		this.writeToCache();
	}

	private isnoteIDValid(noteID: string): boolean {
		return (this.openNotes.includes(noteID) || this.unopenedNotes.includes(noteID));
	}

	public async writeToCache(): Promise<void> {
		console.log('writing to cache');
		this.cachedData.currentnoteID = this.activenoteID;
		this.cachedData.openNotes = this.openNotes;

		await NoteUtils.writeCache(this.userSettings.cacheFileName, JSON.stringify(this.cachedData, null, 2));
	}
}

interface SessionData {
	currentnoteID: string;
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
