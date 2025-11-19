import { Entry } from "./entry";
import { Note } from "./note";
import { NoteUtils } from "./note-utils";

class Manager {
	notes: Note[] = [];
	activeNoteIndex: number;
	userSettings = {
		indentString: "\t",
		groupInterval: 5, // minutes
		noteIndexFileName: ".note_headings",
	};
	logInput: HTMLTextAreaElement;

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
			//console.log(e);
			if (e.keyCode == 9) { // Tab key - because Shift + Tab returns e.key == "Unidentified"
				e.preventDefault();
				const start: number = this.logInput.selectionStart;
				const end: number = this.logInput.selectionEnd;

				const text: string = this.logInput.value;

				if (e.shiftKey) { // Shift + Tab should be outdent/dedent
					const newText: string = NoteUtils.shiftSelectedText(text, start, end, -1);
					this.logInput.value = newText;
					
				} else {
					const newText: string = NoteUtils.shiftSelectedText(text, start, end, 1);
					this.logInput.value = newText;
				}

			} else if (e.key == 'Enter') {
				if (e.shiftKey) {
					e.preventDefault();
					this.submitEntry(this.logInput.value.trim());
				}
			}
		});

		const submitEntryButton = document.getElementById("submit-entry-button") as HTMLButtonElement;
		submitEntryButton.addEventListener("click", (e) => { this.submitEntry(this.logInput.value.trim()) });
		
	}

	private displayCurrentNote() {
		if (this.activeNoteIndex == null) return; // TODO

		const entriesContainer = document.getElementById("entry-container") as HTMLDivElement;
		entriesContainer.innerHTML = "";
		
		for (const entry of this.notes[this.activeNoteIndex].entries) {
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
		
			const splitLines = entry.text.split('\n');

			let parents = []; // A stack that keeps track of the current nesting.
			
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
				entryTextSpan.textContent = line;
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

				// entryDiv.appendChild(entryTextDiv);
				// // TODO: Grouping 

			}
			entriesContainer.appendChild(entryDiv);
		}
		//<div class="entry-content">
					// 	<div class="entry-text">
					// 		<span class="disclosure-widget"></span><span>Note content here</span>
					// 		<div class="entry-text"><span class="disclosure-widget"></span><span>Nested note content here</span>
					// 			<div class="entry-text"><span class="disclosure-widget"></span><span>Inception!</span></div>
					// 		</div>
					// 		<div class="entry-text"><span class="disclosure-widget"></span><span>A second line on the same level</span></div>
					// 	</div>
					// 	<div class="entry-text"><span class="disclosure-widget"></span><span>Another line on the main level</span></div>
					// </div>

	}

	private updateLogInputHeight() {
		this.logInput.style.height = "0px";
		this.logInput.style.height = this.logInput.scrollHeight + "px";
	}

	private submitEntry(entryText: string) {
		// Get the active Note at this.notes[activeNoteId]
		// Get current time and date
		// Compare w time of prev. entry
		// If within this.userSettings.groupInterval minutes of each other, groupId = same as prev msg
		// Otherwise, groupId = prev msg + 1
		if (this.activeNoteIndex == null) return; // TODO
		const note = this.notes[this.activeNoteIndex];
		const currentTime = new Date();
		const groupId = 0; // TODO
		//let indentLevel = entryText.split('\n')[entryText.length - 1].split(this.userSettings.indentString).length - 1;
		const split = entryText.split('\n');
		const indentLevel = (split[split.length - 1].match(`/${this.userSettings.indentString}/`) || []).length;
		
		const newEntry = new Entry(note.entries ? note.entries.length : 0, groupId, entryText, currentTime, indentLevel);
		note.addEntry(newEntry);

		// TODO: Verify that the entry was submitted before clearing textarea
		
		this.logInput.value = "\t".repeat(indentLevel); 
		this.updateLogInputHeight();

		this.displayCurrentNote();
		console.log(groupId);
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