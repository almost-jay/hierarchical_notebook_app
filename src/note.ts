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
	isUnsaved: boolean;
	isTitleSet: boolean;

	constructor(title: string, created?: Date, lastSaved?: Date) {
		this.title = title;
		this.id = NoteUtils.slugify(title);
		this.isUnsaved = true;
		this.isTitleSet = false;
		this.created = created ?? new Date();
		if (this.lastSaved) this.lastSaved = lastSaved;
	}

	public updatePersistentTextContent(textContent: string) {
		this.persistentText = textContent;

		this.isUnsaved = this.persistentText != this.savedPersistentText;
	}

	public async loadFromFile(): Promise<void> {
		const persistentFileName = `${this.title}-persistent.md`;
		const entriesFileName = `${this.title}-entries.bin`;
		if(NoteUtils.doesFileExist(persistentFileName)) {
			this.persistentText = await NoteUtils.getMarkdownFile(persistentFileName);
			
			if (NoteUtils.doesFileExist(entriesFileName)) {
				const entryFile = await NoteUtils.getBinaryFile(entriesFileName);
				const dataView = new DataView(entryFile);
				let i = 0;
				while (i < entryFile.byteLength) {
					const id = dataView.getUint16(0);
					const groupId = dataView.getUint16(2);
					const quotedId = dataView.getUint16(4);
					const indentLevel = dataView.getUint8(6);
					const created = new Date(Number(dataView.getBigUint64(7)));
					const lastEdited = new Date(Number(dataView.getBigUint64(16)));
					const textLength = dataView.getUint16(23);
					const text = new TextDecoder("utf-8").decode(entryFile.slice(textLength)); // ? Should this be split across multiple lines

					this.entries.push(new Entry(id, groupId, text, created, indentLevel, lastEdited, quotedId));
					i += 25 + textLength;
				}
				this.isUnsaved = false;
			} else {
				console.error(`Could not find entries file ${entriesFileName}!`);
			}
		} else {
			console.error(`Could not find markdown file ${persistentFileName}!`);
		}
	}

	async save() {
		if (!this.isTitleSet) {
			let newTitle: string = this.persistentText.split("\n")[0];
			let newId: string = NoteUtils.slugify(newTitle);
			if (newId == "") {
				if (!confirm(`Save this note as ${this.id}.md?`)) return;
			}
			this.title = newTitle;
			this.id = newId;
			this.isTitleSet = true;
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
		let frontmatter: String = `---\ntitle: ${this.title}\ncreated: ${this.created.getTime()}\nlastSaved: ${this.lastSaved.getTime()}---`;

		await NoteUtils.writeMarkdownFile(persistentFileName, frontmatter + this.persistentText);
		await NoteUtils.writeBinaryFile(entriesFileName, entriesAsBinary);

		this.savedPersistentText = this.persistentText;
		this.isUnsaved = false;
	}


	load() {
		
		// Get file from filepath for both entries and persistent
		

	}
	
	public addEntry(newEntry: Entry): void {
		this.entries.push(newEntry);
	}

	public updateEntry(targetEntryId: number, newText: string) {
		// this.entries[id].text = newText
	}

	rename() {
		// TODO
	}
	
}
