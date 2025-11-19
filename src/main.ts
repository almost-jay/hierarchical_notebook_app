import { Entry } from "./entry";
import { Note } from "./note";
import { NoteUtils } from "./note-utils";

class Manager {
	notes: Note[] = [];
	activeNoteIndex: number;
	userSettings = {
		indentString: "\t",
		groupInterval: 1, // minutes
		noteIndexFileName: ".note_headings",
	};
	logInput: HTMLTextAreaElement;
	currentIndentationLevel: number = 0;
	public constructor() {
		this.logInput = document.getElementById("log-input") as HTMLTextAreaElement;
		
		this.initialiseNote();
		this.initialiseInput();
		// TODO: Also store and fetch user settings
		// TODO: Also cache and load data
	}

	private initialiseNote() {
		// TODO: Load a note from the dang cache
		// Also the overview is in Notes
		this.notes.push(new Note("Note 1"));
		this.activeNoteIndex = 0;
		// STUB FUNCTION
	}

	private initialiseInput() {
		const entriesContainer = document.getElementById("entry-container") as HTMLDivElement;

		entriesContainer.addEventListener("click", (e) => {
			const target = e.target as HTMLElement;
			if (target.classList.contains("disclosure-widget")) {
				const parent = target.parentElement;
				if (!parent) return;

				parent.classList.toggle("collapsed");
			}
		});
		
		this.logInput.addEventListener("input", (e) => {
			this.updateLogInputHeight();
		});
		this.logInput.addEventListener("keydown", (e) => {
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

		const submitEntryButton = document.getElementById("submit-entry-button") as HTMLButtonElement;
		submitEntryButton.addEventListener("click", (e) => { this.submitEntry() });
		
	}

	private displayCurrentEntries() {
		if (this.activeNoteIndex == null) return; // TODO
		
		const entriesContainer = document.getElementById("entry-container") as HTMLDivElement;
		entriesContainer.innerHTML = "";

		let entries = this.notes[this.activeNoteIndex].entries;
		let groupedEntries: Array<Entry> = [this.notes[this.activeNoteIndex].entries[0]];
		for (const entry of entries) {
			if (entry.groupId > groupedEntries[groupedEntries.length - 1].groupId) {
				groupedEntries.push(entry);
			}
		}
		
		for (let groupId = 0; groupId < groupedEntries.length; groupId++) {
			const entry = groupedEntries[groupId];

			const entryDiv = document.createElement("div");
			entryDiv.classList.add("entry-content");

			const entryHeader = document.createElement("div");
			entryHeader.classList.add("entry-header");

			const headingBreak = document.createElement("hr");
			entryHeader.appendChild(headingBreak);

			const timestampSpan = document.createElement("span");
			timestampSpan.textContent = NoteUtils.formatDate(entry.created); // TODO: Relative/contextual/fuzzy time
			entryHeader.appendChild(timestampSpan);

			entryDiv.appendChild(entryHeader);
			
			let textContent = entry.text;

			const iStop = groupedEntries[groupId + 1] ? groupedEntries[groupId + 1].id : entries[entries.length - 1].id + 1

			for (let i = entry.id + 1; i < iStop; i++) {
					textContent += "\n"+entries[i].text;
			}

			const splitLines = textContent.split('\n');

			let parents = [];
			
			for (let i = 0; i < splitLines.length; i++) {
				const line: string = splitLines[i];

				const currentIndentationLevel: number = this.countLeadingTabs(line);
				const text: string = this.stripLeadingTabs(line);

				let hasChildren = false;
				if (i < splitLines.length - 1) {
					const nextIndentationLevel = this.countLeadingTabs(splitLines[i + 1]);
					if (nextIndentationLevel > currentIndentationLevel) {
						hasChildren = true;
					}
				}

				const entryTextDiv = document.createElement("div");
				entryTextDiv.classList.add("entry-text");

				if (hasChildren) { // We only add the disclosure widget if the current element has things to disclose
					const disclosureWidget = document.createElement("span");
					disclosureWidget.classList.add("disclosure-widget");
					entryTextDiv.appendChild(disclosureWidget);
				}

				const entryTextSpan = document.createElement("span");
				entryTextSpan.textContent = text;
				entryTextDiv.appendChild(entryTextSpan);
				
				let parentContainer = entryDiv;
				for (let j = currentIndentationLevel - 1; j >= 0; j--) {
					if (parents[j]) {
						parentContainer = parents[j];
						break;
					}
				}
				
				parentContainer.appendChild(entryTextDiv);
				parents = parents.slice(0, currentIndentationLevel); // Truncate because otherwise we end up with stale deeper levels
				parents[currentIndentationLevel] = entryTextDiv;
			}
			entriesContainer.appendChild(entryDiv);
		}
	}

	private insertNewLine() {
		const lines = this.logInput.value.split('\n');
		const currentLine = lines[lines.length - 1];
		this.currentIndentationLevel = this.countLeadingTabs(currentLine);
		
		const newLine = '\n' + this.userSettings.indentString.repeat(this.currentIndentationLevel);
		this.logInput.value += newLine;

		this.updateLogInputHeight();
	}

	private updateLogInputHeight() {
		this.logInput.style.height = "0px";
		this.logInput.style.height = this.logInput.scrollHeight + "px";
	}

	private submitEntry() {
		const entryText = this.logInput.value.trim();
		if (entryText.length == 0) return;
		if (this.activeNoteIndex == null) return; // TODO
		const note = this.notes[this.activeNoteIndex];
		const currentTime = new Date();
		let groupId = 0;
		if (note.entries.length > 0) {
			groupId = note.entries[note.entries.length - 1].groupId;
			let previousEntryCreated = note.entries[note.entries.length - 1].created;
			let timeSincePreviousEntry = currentTime.getTime() - previousEntryCreated.getTime();
			if (timeSincePreviousEntry / 60000 > this.userSettings.groupInterval) { // divide by 60000 ∵ ms -> minutes
				groupId++;
			}
		}
		
		const splitLines = entryText.split('\n');
		const indentLevel = this.countLeadingTabs(splitLines[splitLines.length - 1]);
		
		const newEntry = new Entry(note.entries ? note.entries.length : 0, groupId, entryText, currentTime, indentLevel);
		note.addEntry(newEntry);

		// TODO: Verify that the entry was submitted before clearing textarea
		
		this.logInput.value = (this.userSettings.indentString).repeat(indentLevel);
		console.log( (this.userSettings.indentString).repeat(indentLevel));
		this.updateLogInputHeight();

		this.displayCurrentEntries();
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
	
	countLeadingTabs(line): number {
		return line.match(new RegExp(`^${this.userSettings.indentString}+`))?.[0].length || 0;

	}

	stripLeadingTabs(line) {
		return line.replace(new RegExp(`^${this.userSettings.indentString}+`), '');
	}
}

const manager = new Manager();