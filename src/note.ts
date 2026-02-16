import { Entry, ENTRY_BINARY_FORMAT } from './entry';
import { NoteUtils } from './note-utils';

export class Note {
	public id: string; // Slugified version of title
	public title: string;
	protected entries: Entry[] = [];
	public created: Date;
	public lastSaved?: Date;
	protected isEntriesUnsaved: boolean = false;
	protected isPersistentTextUnsaved: boolean = false;
	protected isTitleSet: boolean = false;
	private persistentText: string = '';
	private savedPersistentText: string = '';
	private persistentTextHistory: string[] = [''];
	private lastHistoryUpdate: number = 0;
	private historyIndex: number = 0;

	public constructor(title: string, created?: Date, lastSaved?: Date, savedPersistentText?: string) {
		this.updateTitle(title);
		this.created = created ?? NoteUtils.startOfDay(new Date());
		if (lastSaved) this.lastSaved = lastSaved;
		if (savedPersistentText) this.savedPersistentText = savedPersistentText;
	}

	public static async loadFromFile(noteID: string, undoStackSize: number, saveDebounceTime: number): Promise<Note> {
		const persistentFileName: string = `${noteID}-persistent`;
		const entriesFileName: string = `${noteID}-entries`;
		if (await NoteUtils.doesFileExist(persistentFileName+'.md')) {
			const fileText: string = await NoteUtils.getMarkdownFile(persistentFileName);
			const title = fileText.match(/title:\s*(.+)/)?.[1] ?? '';
			const created = new Date(Number(fileText.match(/created:\s*(\d+)/)?.[1] ?? '0'));
			const lastSaved = new Date(Number(fileText.match(/lastSaved:\s*(\d+)/)?.[1] ?? '0'));

			const textContentMatch = fileText.match(/(?:---\n[\s\S]*?---\n)([\s\S]*)/);
			const textContent = textContentMatch ? textContentMatch[1].trim() : '';
			
			const newNote = new Note(title, created, lastSaved, textContent);
			newNote.updateSavedPersistentTextContent(textContent, undoStackSize, saveDebounceTime );

			newNote.isTitleSet = true;

			if (await NoteUtils.doesFileExist(entriesFileName+'.bin')) {
				const entryFile = await NoteUtils.getBinaryFile(entriesFileName);
				const dataView = new DataView(entryFile);
				let i = 0;

				while (i < entryFile.byteLength) {
					const textLength = dataView.getUint16(i + ENTRY_BINARY_FORMAT.TEXT_LENGTH_OFFSET);
					const entryLength = i + ENTRY_BINARY_FORMAT.HEADER_SIZE + textLength;
					const newEntry = Entry.fromBinary(entryFile.slice(i, entryLength));
					newNote.addEntry(newEntry)
					i += ENTRY_BINARY_FORMAT.HEADER_SIZE + textLength;

				}
				newNote.isEntriesUnsaved = false;
				return newNote;
			} else {
				console.error(`Could not find entries file ${entriesFileName}!`);
			}
		} else {
			console.error(`Could not find markdown file ${persistentFileName}!`);
		}
	}

	public modifyEntry(entryID: number, newText: string, editedTime: Date): void {
		if (this.entries[entryID].text == newText) return;
		
		this.entries[entryID].modifyEntry(newText, editedTime);
		this.isEntriesUnsaved = true;
	}

	public updateTitle(newTitle: string): void {
		this.title = newTitle;
		this.id = NoteUtils.slugify(newTitle);
	}

	public isUnsaved(): boolean {
		const result = this.isPersistentTextUnsaved || this.isEntriesUnsaved || !this.isTitleSet;
		return result;
	}

	public hasEverBeenSaved(): boolean {
		return this.isTitleSet;
	}

	public getPersistentTextContent(): string {
		return this.persistentText;
	}

	public updatePersistentTextContent(textContent: string, undoStackSize: number, saveDebounceTime: number): void {
		if (this.persistentText == textContent) return;

		this.persistentText = textContent;
		this.updatePersistentTextHistory(undoStackSize, saveDebounceTime);
		this.isPersistentTextUnsaved = !(this.persistentText == this.savedPersistentText);
	}

	public updateSavedPersistentTextContent(textContent: string, undoStackSize: number, saveDebounceTime: number): void {
		if (this.savedPersistentText == textContent) return;

		this.savedPersistentText = textContent;
		this.updatePersistentTextContent(textContent, undoStackSize, saveDebounceTime);
	}

	public updatePersistentTextHistory(undoStackSize: number, saveDebounceTime: number, force: boolean = false): void {
		if (!this.isPersistentTextUnsaved) return;
		if (this.persistentTextHistory[this.historyIndex] == this.persistentText) return;

		const currentTime = Date.now();
		if (currentTime - this.lastHistoryUpdate > saveDebounceTime || force) {

			if (this.historyIndex < this.persistentTextHistory.length) {
				this.persistentTextHistory.splice(this.historyIndex + 1);
			}
			this.persistentTextHistory.push(this.persistentText);

			if (this.persistentTextHistory.length > undoStackSize) {
				this.persistentTextHistory.shift();
			}

			this.lastHistoryUpdate = currentTime;
			this.historyIndex = this.persistentTextHistory.length - 1;
		}
	}

	public undo(undoStackSize: number, saveDebounceTime: number): boolean {
		if (this.historyIndex == 0) return false;

		this.updatePersistentTextHistory(undoStackSize, saveDebounceTime, true);

		this.historyIndex--;
		this.updatePersistentTextContent(this.persistentTextHistory[this.historyIndex], undoStackSize, saveDebounceTime);
		return true;
	}

	public redo(undoStackSize: number, saveDebounceTime: number): boolean {
		if (this.historyIndex >= this.persistentTextHistory.length - 1) return false;

		this.historyIndex++;
		this.updatePersistentTextContent(this.persistentTextHistory[this.historyIndex], undoStackSize, saveDebounceTime);
		return true;
	}

	public deleteEntry(entryID: number): void {
		const entries = this.getOwnEntries();
		if (!entries[entryID]) return;
		
		if (entries[entryID].id == entryID) {
			entries.splice(entryID, 1);
			for (let i = entryID; i < entries.length; i++) {
				entries[i].id = i;
			}

			this.isEntriesUnsaved = true;
		}
	}

	public async save(): Promise<boolean> {
		if (!this.isTitleSet) {
			const newTitle: string = this.persistentText.split('\n')[0];
			const newId: string = NoteUtils.slugify(newTitle);
			if (newId == '') {
				if (!(await confirm(`Save this note as ${this.id}.md?`))) {
					return false;
				} else {
					this.title = this.id;
					this.isTitleSet = true;
				}
			} else {
				this.title = newTitle;
				this.id = newId;
				this.isTitleSet = true;
			}
		}
		// Write to filepath for both entries and persistent
		const persistentFileName = `${this.id}-persistent`;
		const entriesFileName = `${this.id}-entries`;
		const buffers: ArrayBuffer[] = this.getOwnEntries().map(e => e.toBinary());	
		const totalLength = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);

		const entriesAsBinary = new Uint8Array(totalLength); // ArrayBuffer can't be directly concatenated, so we put a Uint8Array over it

		let offset = 0;
		for (const buffer of buffers) {
			entriesAsBinary.set(new Uint8Array(buffer), offset);
			offset += buffer.byteLength;
		}

		this.lastSaved = new Date();
		const frontmatter: string = `---\ntitle: ${this.title}\ncreated: ${this.created.getTime()}\nlastSaved: ${this.lastSaved.getTime()}\n---\n`;
		await NoteUtils.writeMarkdownFile(persistentFileName, frontmatter + this.persistentText);
		await NoteUtils.writeBinaryFile(entriesFileName, entriesAsBinary);

		this.savedPersistentText = this.persistentText;
		this.isEntriesUnsaved = false;
		this.isPersistentTextUnsaved = false;

		return true;
	}

	public getOwnEntries(): Entry[] {
		return this.entries;
	}

	/* This exists because of the overview class **/
	public getDisplayedEntries(): Entry[] {
		return this.entries;
	}

	public createNewEntry(entryText: string, currentTime: Date, indentLevel: number, groupInterval: number, quotedEntryID?: number): Entry {
		const entries = this.entries;
		let groupID = 0;

		if (entries.length > 0) {
			groupID = entries[entries.length - 1].groupId;
			const previousEntryCreated = entries[entries.length - 1].created;
			const timeSincePreviousEntry = currentTime.getTime() - previousEntryCreated.getTime();
			if (timeSincePreviousEntry / 60000 > groupInterval) {
				groupID++;
			}
		}
		const newEntry = new Entry(this.entries.length, groupID, entryText, currentTime, indentLevel, quotedEntryID);
		this.isEntriesUnsaved = true;
		this.addEntry(newEntry);

		return newEntry;
	}

	public addEntry(entry: Entry): void {
		this.entries.push(entry);
	}

	public updateEntry(targetEntryId: number, newText: string): void {
		this.entries[targetEntryId].text = newText;
		// TODO
	}

	public rename(): void {
		// TODO
	}
	
}
