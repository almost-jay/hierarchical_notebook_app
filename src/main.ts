import { appDataDir, appCacheDir, appConfigDir } from "@tauri-apps/api/path";
import { exists, readTextFile } from "@tauri-apps/plugin-fs";
import { Entry } from "./entry";
import { Note } from "./note";
import { NoteUtils } from "./note-utils";

class Manager {
	notes: Note[] = [];
	activeNoteId?: string;
	userSettings = {
		indentString: "\t",
		groupInterval: 5, // minutes
		noteIndexFileName: ".note_headings",
	}

	public constructor() {
		this.initialiseInput();
	}

	private initialiseInput() {
		const logInput = document.getElementById("log-input") as HTMLTextAreaElement;
		logInput.addEventListener("input", (e) => {
			logInput.style.height = "0px";
			logInput.style.height = logInput.scrollHeight + "px";
		})
		logInput.addEventListener("keydown", (e) => {
			console.log(e);
			if (e.keyCode == 9) { // Tab key - because Shift + Tab returns e.key == "Unidentified"
				e.preventDefault();
				const start: number = logInput.selectionStart;
				const end: number = logInput.selectionEnd;

				const text: string = logInput.value;

				if (e.shiftKey) { // Shift + Tab should be outdent/dedent
					const newText: string = NoteUtils.shiftSelectedText(text, start, end, -1);
					logInput.value = newText;
					
				} else {
					const newText: string = NoteUtils.shiftSelectedText(text, start, end, 1);
					logInput.value = newText;
				}

			} else if (e.key == 'Enter') {
				if (e.shiftKey) {
					this.submitEntry(logInput.value.trim())
				}
			}
		});
	}

	private submitEntry(entryText: string) {
		// Get the active Note at this.notes[activeNoteId]
		// Get current time and date
		// Compare w time of prev. entry
		// If within this.userSettings.groupInterval minutes of each other, groupId = same as prev msg
		// Otherwise, groupId = prev msg + 1
		let note = this.notes[this.activeNoteId || 0];
		let currentTime = new Date();
		let groupId = 0;
		let indentLevel = entryText.split('\n')[entryText.length - 1].split(this.userSettings.indentString).length - 1;
		note.addEntry(new Entry(note.entries.length, groupId, entryText, currentTime,  indentLevel))
	}

	private loadAllNotes() {
		// Check if the headings file exists
		// If it does, we will  

		if (NoteUtils.doesFileExist(this.userSettings.noteIndexFileName)) {
			let notesList = NoteUtils.getMarkdownFile(this.userSettings.noteIndexFileName);
		} else {
			// We will not create any notes.
		}
	}

	private saveAllNotes() {
		this.userSettings.noteIndexFileName
	}
}

const manager = new Manager();