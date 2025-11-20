import { Entry } from "./entry";
import { NoteUtils } from "./note-utils";

export class Note {
	id: string; // Slugified version of title
	title: string; // 
	persistentText: string = "";
	savedPersistentText: string = "";
	entries: Entry[] = [];
	created: Date;
	lastSaved?: Date;
	isEntriesUnsaved: boolean;
	isPersistentTextUnsaved: boolean;
	isTitleSet: boolean;

	constructor(title: string, created?: Date, lastSaved?: Date, savedPersistentText?: string) {
		this.title = title;
		this.id = NoteUtils.slugify(title);
		this.isPersistentTextUnsaved = true;
		this.isTitleSet = false;
		this.created = created ?? new Date();
		if (lastSaved) this.lastSaved = lastSaved;
		if (savedPersistentText) this.savedPersistentText = savedPersistentText;
	}

	public updatePersistentTextContent(textContent: string) {
		this.persistentText = textContent;

		this.isPersistentTextUnsaved = this.persistentText != this.savedPersistentText;
	}

	public static async loadFromFile(noteId: string): Promise<Note> {
		const persistentFileName = `${noteId}-persistent`;
		const entriesFileName = `${noteId}-entries`;
		if(NoteUtils.doesFileExist(persistentFileName+".md")) {
			const fileText: string = await NoteUtils.getMarkdownFile(persistentFileName);
			const title = fileText.match(/title:\s*(.+)/)?.[1] ?? "";
			const created = new Date(Number(fileText.match(/created:\s*(\d+)/)?.[1] ?? "0"));
			const lastSaved = new Date(Number(fileText.match(/lastSaved:\s*(\d+)/)?.[1] ?? "0"));

			const textContentMatch = fileText.match(/(?:---\n[\s\S]*?---\n)([\s\S]*)/);
			const textContent = textContentMatch ? textContentMatch[1].trim() : '';
			
			const newNote = new Note(title, created, lastSaved, textContent);
			newNote.updatePersistentTextContent(textContent);
			newNote.isTitleSet = true;

			if (NoteUtils.doesFileExist(entriesFileName+".bin")) {
				const entryFile = await NoteUtils.getBinaryFile(entriesFileName);
				const dataView = new DataView(entryFile);
				let i = 0;

				while (i < entryFile.byteLength) {
					const id = dataView.getUint16(i + 0);
					const groupId = dataView.getUint16(i + 2);
					const quotedId = dataView.getUint16(i + 4);
					const indentLevel = dataView.getUint8(i + 6);
					const created = new Date(Number(dataView.getBigUint64(i + 7)));
					const lastEdited = new Date(Number(dataView.getBigUint64(i + 15)));
					const textLength = dataView.getUint16(i + 23);
					const text = new TextDecoder("utf-8").decode(entryFile.slice(i + 25, i + 25 + textLength)); // ? Should this be split across multiple lines

					newNote.addEntry(new Entry(id, groupId, text, created, indentLevel, lastEdited, quotedId));
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

	async save(): Promise<boolean> {
		if (!this.isTitleSet) {
			let newTitle: string = this.persistentText.split("\n")[0];
			let newId: string = NoteUtils.slugify(newTitle);
			if (newId == "") {
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
		
		const buffers: ArrayBuffer[] = this.entries.map(e => e.toBinary());	
		const totalLength = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);

		const entriesAsBinary = new Uint8Array(totalLength); // ArrayBuffer can't be directly concatenated, so we put a Uint8Array over it

		let offset = 0;
		for (const buffer of buffers) {
			entriesAsBinary.set(new Uint8Array(buffer), offset);
			offset += buffer.byteLength;
		}
		

		this.lastSaved = new Date();
		let frontmatter: string = `---\ntitle: ${this.title}\ncreated: ${this.created.getTime()}\nlastSaved: ${this.lastSaved.getTime()}---`;

		await NoteUtils.writeMarkdownFile(persistentFileName, frontmatter + this.persistentText);
		await NoteUtils.writeBinaryFile(entriesFileName, entriesAsBinary);

		this.savedPersistentText = this.persistentText;
		this.isEntriesUnsaved = false;
		this.isPersistentTextUnsaved = false;

		return true;
	}


	load() {
		
		// Get file from filepath for both entries and persistent
		

	}
	
	public addEntry(newEntry: Entry): void {
		this.entries.push(newEntry);
		this.isEntriesUnsaved = true;
	}

	public updateEntry(targetEntryId: number, newText: string) {
		// this.entries[id].text = newText
	}

	rename() {
		// TODO
	}
	
}
