import { Entry } from './entry';
import { Note } from './note';
import { NoteUtils } from './note-utils';
import { Overview } from './overview';

export class NoteManager {
	private notes: Map<string, Note>;
	private overview: Overview;
	private activeNoteId: string = '.overview';
	private openNotes: Set<string>; //openNotes ∩ unopenedNotes = ∅ 
	private unopenedNotes: Set<string>; 
	private cachedData: SessionData;
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
	private async loadAllNotes(): Promise<{ id: string, title: string }[]> {
		// loadAllNotes and part of initialiseAsync
		// Ensure all notes exist internally
		// Place each note ID in unopenednotes
		// Load overview note metadata but NOT content

		// Set savedPersistentText = loaded content

		const notesAdded = [];
		const noteHeadingsFileName = this.userSettings.noteIndexFileName+'.md';
		if (await NoteUtils.doesFileExist(noteHeadingsFileName)) {
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
	 * @returns {string[]} A list of note IDs that need to be opened!
	 */
	public async restorePreviousSession(): Promise<string[]> {
		if (! (await NoteUtils.doesCacheExist(this.userSettings.cacheFileName))) return [];

		const cacheText = await NoteUtils.readCache(this.userSettings.cacheFileName);
		const cacheParsed = JSON.parse(cacheText) as Partial<SessionData>;

		this.cachedData = { ...this.cachedData, ...cacheParsed };

		for (const noteID of this.cachedData.openNotes) {
			this.openNote(noteID);
		}

		return Array.from(this.openNotes);
	}

	private createNewNote(noteTitle: string): void {
		const newNote = new Note(noteTitle);
		this.addNewNote(newNote);
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
	private changeCurrentNote(noteID: string): { noteID: string, textContent: string } | null {
		// Same logic as setCurrentNote minus the dom shit
		// logic inside the tab click handlers?
		// Fires onActiveNoteChanged(noteID)

		if (!this.notes.has(noteID)) return null;

		this.activeNoteId = noteID;
		this.cachedData.currentNoteId = noteID;

		const note = this.notes.get(noteID);
		if (!note) return null;
		const textContent = note.getPersistentTextContent();
		
		return  { noteID, textContent: textContent };
	}

	/**
	 * @todo use try/catch
	 */
	public openNote(noteID: string): void {
		// UIManager will do all the dom stuff

		// Move ID from unopened to openNotes
		// Update internal metadata
		if (!this.unopenedNotes.has(noteID)) throw new Error(`Could not find note with id ${noteID}`);

		this.unopenedNotes.delete(noteID);
		this.openNotes.add(noteID);
	}

	/**
	 * @todo Use a try/catch; also remember to select the returned note in DOM
	 */
	private closeCurrentNote(): string {
		// Remove note from openNotes and select fallback active note
		// Basically the same but without the DOM shit

		if (!this.openNotes.has(this.activeNoteId)) throw new Error(`Could not find note with id ${this.activeNoteId}`);

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
	private async saveAllNotes(): Promise<{ success: boolean; oldID: string; newID: string; }[]> {
		const results: { success: boolean, oldID: string, newID: string }[] = [];

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
	private async saveNote(noteID: string): Promise<{ success: boolean, oldID: string, newID: string }> {
		const note = this.notes.get(noteID);
		if (!note) return { success: false, oldID: noteID, newID: noteID };

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

		return { success: result, oldID, newID };
	}

	private async saveMetadata(): Promise<void> {
		const noteHeadings = Array.from(this.openNotes).join('\n') + '\n' + Array.from(this.unopenedNotes).join('\n');
		await NoteUtils.writeMarkdownFile(this.userSettings.noteIndexFileName,noteHeadings);
		await this.writeToCache();
	}

	/**
	 * 
	 * @param newTitle 
	 * @returns the new ID and title
	 */
	private updateNoteTitle(oldID: string, rawNewTitle: string): { oldID: string, newID: string, newTitle: string } | null {
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

	private updatePersistentText(noteID: string, newText: string): void {
		// Update note.persistentText
		// Trigger cache update callback
		// Notify UI that note's unsaved state changed

		const note = this.notes.get(noteID);
		if (!note) return;
		
		note.updatePersistentTextContent(newText);
		
		if (note.isUnsaved()) {
			this.cachedData.unsavedPersistentText[noteID] = newText;
			this.writeToCache();
		} else if (noteID in this.cachedData.unsavedPersistentText) {
			delete this.cachedData.unsavedPersistentText[noteID];
		}
	}

	/** 
	 * UIManager: Take the newEntry passed back and add it to the DOM
	*/
	private submitEntry(entryText: string, currentTime: Date): Entry | null {
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
		const indentLevel = this.countLeadingTabs(splitLines[splitLines.length - 1]);
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

	private async writeToCache(): Promise<void> {
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
