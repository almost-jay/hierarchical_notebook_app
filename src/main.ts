import { Entry } from "./entry";
import { Note } from "./note";
import { NoteUtils } from "./note-utils";
import { EntryWithSource, Overview } from "./overview";

class Manager {
	notes: Note[] = [];
	overview: Overview;
	activeNoteIndex: number;
	userSettings = {
		indentString: "\t",
		groupInterval: 5, // minutes
		noteIndexFileName: ".note_headings",
	};
	logInput: HTMLTextAreaElement;
	currentIndentationLevel: number = 0;

	public constructor() {
		this.logInput = document.getElementById("log-input") as HTMLTextAreaElement;

		this.initialiseNotes();
		this.overview = this.initialiseOverview();
		this.updateOverview();
		this.initialiseInput();
		// TODO: Also store and fetch user settings
		// TODO: Also cache and load data
		this.setCurrentNote(this.notes[this.notes.length - 1].id);
	}

	private initialiseNotes() {

		// TODO: Load a note from the dang cache
		// Also the overview is in Notes

		const noteTabsContainer = document.getElementById("note-tabs") as HTMLDivElement;
		noteTabsContainer.innerHTML = "";

		this.addNewNote("Untitled 1"); // DEBUG
		for (const note of this.notes) {
		}
		// FOR i in note
		// do:
		// uhhh render it or sum idfk
		// STUB FUNCTION
	}

	private initialiseOverview(): Overview {
		const overview = new Overview([]);
		this.notes.unshift(overview);
		return overview;
	}

	private initialiseInput() {
		const noteTabsContainer = document.getElementById("sidebar") as HTMLFormElement;
		noteTabsContainer.addEventListener("click", (e) => {
			const target = e.target as HTMLElement;
			if (target.className == "tab-input") {
				this.setCurrentNote(target.id);
			}

		});

		const addNotetab = document.getElementById("add-note-tab") as HTMLDivElement;
		addNotetab.addEventListener("click", (e) => {
			e.preventDefault();
			this.addNewNote(`Untitled ${this.notes.length}`);
			this.setCurrentNote(this.notes[this.notes.length - 1].id);
		});

		const overviewDateSelector = document.getElementById("start-date-selector") as HTMLInputElement;
		overviewDateSelector.min = this.overview.earliestDate;
		overviewDateSelector.addEventListener("change", (e) => {
			const newDate = new Date(overviewDateSelector.value);
			this.overview.updateSelectedDate(newDate);
		});

		const overviewDateRangeSelector = document.getElementById("date-range-selector");

		const overviewDayPrev = document.getElementById("day-prev") as HTMLButtonElement;
		const overviewDayNext = document.getElementById("day-next") as HTMLButtonElement;

		overviewDayPrev.addEventListener("click", (e) => {
			overviewDayPrev.disabled = this.overview.stepBackward();
		});

		overviewDayNext.addEventListener("click", (e) => { overviewDayNext.disabled = this.overview.stepForward(); });


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

		if (entries.length == 0) return;

		for (let currentIndex = 0; currentIndex < entries.length; ) {
			const groupStartEntry = entries[currentIndex];
			const currentGroupId = groupStartEntry.groupId;
			
			let textContent = groupStartEntry.text;
			let nextIndex = currentIndex + 1;

			while (nextIndex < entries.length && entries[nextIndex].groupId === currentGroupId) {
				textContent += "\n" + entries[nextIndex].text;
				nextIndex++;
			}

			const entryDiv = document.createElement("div");
			entryDiv.classList.add("entry-content");

			const entryHeader = document.createElement("div");
			entryHeader.classList.add("entry-header");

			const headingBreak = document.createElement("hr");
			entryHeader.appendChild(headingBreak);

			const timestampSpan = document.createElement("span");
			timestampSpan.textContent = NoteUtils.formatDate(entries[currentIndex].created); // TODO: Relative/contextual/fuzzy time
			entryHeader.appendChild(timestampSpan);

			entryDiv.appendChild(entryHeader);

			const splitLines = textContent.split("\n");
			let parents: HTMLDivElement[] = [];

			for (let i = 0; i < splitLines.length; i++) {
				const line = splitLines[i];
				const indentLevel = this.countLeadingTabs(line);
				const text = this.stripLeadingTabs(line);

				const entryTextDiv = document.createElement("div");
				entryTextDiv.classList.add("entry-text");

				let hasChildren = false;
				if (i < splitLines.length - 1) {
					const nextIndent = this.countLeadingTabs(splitLines[i + 1]);
					hasChildren = nextIndent > indentLevel;
				}

				if (hasChildren) {
					const disclosureWidget = document.createElement("span");
					disclosureWidget.classList.add("disclosure-widget");
					entryTextDiv.appendChild(disclosureWidget);
				}

				const entryTextSpan = document.createElement("span");
				entryTextSpan.textContent = text;
				entryTextDiv.appendChild(entryTextSpan);

				let parentContainer = entryDiv;
				for (let j = 0; j < indentLevel; j++) {
					if (!parents[j]) {
						const emptyDiv = document.createElement("div");
						emptyDiv.classList.add("entry-text");
						parentContainer.appendChild(emptyDiv);
						parents[j] = emptyDiv;
					}
					parentContainer = parents[j];
				}

				parentContainer.appendChild(entryTextDiv);
				parents = parents.slice(0, indentLevel);
				parents[indentLevel] = entryTextDiv;
			}

			entriesContainer.appendChild(entryDiv);
			
			currentIndex = nextIndex;
		}

	}

	private setCurrentNote(noteId: string) {
		const overviewControls = document.getElementById("overview-controls") as HTMLDivElement;
		if (this.activeNoteIndex == 0) {
			overviewControls.classList.remove("show");
		}

		this.activeNoteIndex = this.notes.findIndex(note => note.id === noteId);

		if (!this.notes[this.activeNoteIndex]) return; // TODO

		const noteTitle = document.getElementById("note-title");
		noteTitle.textContent = this.notes[this.activeNoteIndex].title;

		if (this.activeNoteIndex == 0) {
			overviewControls.classList.add("show");
			this.updateOverview();
		}

		this.displayCurrentEntries();
	}

	private addNewNote(noteTitle: string) { // TODO: make sure there is enough space for the note?
		const newNote = new Note(noteTitle);
		this.notes.push(newNote);
		this.activeNoteIndex = this.notes.length - 1;

		const noteTabsContainer = document.getElementById("note-tabs") as HTMLDivElement;

		const radioElement: HTMLInputElement = document.createElement("input");
		radioElement.type = "radio";
		radioElement.id = newNote.id;
		radioElement.name = "note-tabs";
		radioElement.classList.add("tab-input");

		const labelElement: HTMLLabelElement = document.createElement("label");
		labelElement.classList.add("tab-label");
		labelElement.htmlFor = newNote.id;
		labelElement.textContent = newNote.title;

		noteTabsContainer.appendChild(radioElement);
		noteTabsContainer.appendChild(labelElement);

		radioElement.checked = true;
		this.logInput.focus();
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
		const entryText = this.logInput.value;
		if (entryText.trim().length == 0) return;
		if (this.activeNoteIndex == null) return; // TODO

		const note = this.notes[this.activeNoteIndex];
		const currentTime = new Date();

		let groupId = 0;
		if (this.activeNoteIndex == 0) { // The overview has some weirdnesses about grouping, so we need to make sure we use the overview's overviewEntry component instead.
			if (this.overview.overviewEntries.length > 0) {
				groupId = this.overview.overviewEntries[this.overview.overviewEntries.length - 1].groupId;
				let previousEntryCreated = this.overview.overviewEntries[this.overview.overviewEntries.length - 1].created;
				let timeSincePreviousEntry = currentTime.getTime() - previousEntryCreated.getTime();
				if (timeSincePreviousEntry / 60000 > this.userSettings.groupInterval) { // divide by 60000 ∵ ms -> minutes
					groupId++;
				}
			}
		} else if (note.entries.length > 0) {
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
		this.updateLogInputHeight();

		if (this.activeNoteIndex == 0) this.updateOverview();

		this.displayCurrentEntries();
	}

	private updateOverview() {
		let allEntries = [];
		this.overview.clearEntries();
		for (const note of this.notes) {
			allEntries.push(...note.entries.map(entry => ({ entry: entry, sourceNoteId: note.id })));
		}
		this.overview.updateEntries(allEntries);
		this.overview.updateEntriesShown();

		
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