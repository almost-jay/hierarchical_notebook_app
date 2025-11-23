import { Entry } from './entry';
import { NoteUtils } from './note-utils';

export class Note {
	public id: string; // Slugified version of title
	public title: string;
	public entries: Entry[] = [];
	public created: Date;
	public lastSaved?: Date;
	protected isEntriesUnsaved: boolean = false;
	protected isPersistentTextUnsaved: boolean = true;
	protected isTitleSet: boolean;
	private persistentText: string = '';
	private savedPersistentText: string = '';

	public constructor(title: string, created?: Date, lastSaved?: Date, savedPersistentText?: string) {
		this.updateTitle(title);
		this.isTitleSet = false;
		this.created = created ?? new Date();
		if (lastSaved) this.lastSaved = lastSaved;
		if (savedPersistentText) this.savedPersistentText = savedPersistentText;
	}

	public static async loadFromFile(noteId: string): Promise<Note> {
		const persistentFileName: string = `${noteId}-persistent`;
		const entriesFileName: string = `${noteId}-entries`;
		if (await NoteUtils.doesFileExist(persistentFileName+'.md')) {
			const fileText: string = await NoteUtils.getMarkdownFile(persistentFileName);
			const title = fileText.match(/title:\s*(.+)/)?.[1] ?? '';
			const created = new Date(Number(fileText.match(/created:\s*(\d+)/)?.[1] ?? '0'));
			const lastSaved = new Date(Number(fileText.match(/lastSaved:\s*(\d+)/)?.[1] ?? '0'));

			const textContentMatch = fileText.match(/(?:---\n[\s\S]*?---\n)([\s\S]*)/);
			const textContent = textContentMatch ? textContentMatch[1].trim() : '';
			
			const newNote = new Note(title, created, lastSaved, textContent);
			newNote.updateSavedPersistentTextContent(textContent);
			newNote.isTitleSet = true;

			if (await NoteUtils.doesFileExist(entriesFileName+'.bin')) {
				const entryFile = await NoteUtils.getBinaryFile(entriesFileName);
				const dataView = new DataView(entryFile);
				let i = 0;

				while (i < entryFile.byteLength) {
					const textLength = dataView.getUint16(i + 23);
					const entryLength = i + 25 + textLength;
					const newEntry = Entry.fromBinary(entryFile.slice(i, entryLength));
					newNote.addEntry(newEntry)
					i += 25 + textLength;
				}

				return newNote;
			} else {
				console.error(`Could not find entries file ${entriesFileName}!`);
			}
		} else {
			console.error(`Could not find markdown file ${persistentFileName}!`);
		}
	}

	public updateTitle(newTitle: string): void {
		this.title = newTitle;
		this.id = NoteUtils.slugify(newTitle);
	}

	public isUnsaved(): boolean {
		return this.isPersistentTextUnsaved || this.isEntriesUnsaved;
	}

	public getPersistentTextContent(): string {
		return this.persistentText;
	}

	public updatePersistentTextContent(textContent: string): void {
		this.persistentText = textContent;
		
		this.isPersistentTextUnsaved = !(this.persistentText == this.savedPersistentText);
	}

	public updateSavedPersistentTextContent(textContent: string): void {
		this.savedPersistentText = textContent;
		this.updatePersistentTextContent(textContent);
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
		console.log(frontmatter + this.persistentText);
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
	
	public addEntry(newEntry: Entry): void {
		this.entries.push(newEntry);
		this.isEntriesUnsaved = true;
	}

	public updateEntry(targetEntryId: number, newText: string): void {
		this.entries[targetEntryId].text = newText;
		// TODO
	}

	public rename(): void {
		// TODO
	}
	
}
