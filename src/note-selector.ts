export class NoteSelector {
	private isVisible: boolean = false;
	private validNotes: string[] = [];
	private filteredNotes: string[] = [];
	private currentIndex: number = 0;

	private selectionModal: HTMLDivElement;
	private filterBox: HTMLInputElement;
	private listContainer: HTMLUListElement;

	private onSelectCallback: (id: string) => void;
	
	public constructor(onSelect: (id: string) => void) {
		this.selectionModal = document.getElementById('note-selection-modal') as HTMLDivElement;
		this.filterBox = document.getElementById('note-selection-filter') as HTMLInputElement;
		this.listContainer = document.getElementById('unopened-notes-list') as HTMLUListElement;

		this.onSelectCallback = onSelect;

		this.initialiseInput();
	}

	private initialiseInput(): void {
		this.filterBox.addEventListener('input', () => {
			this.filterNotes()
		});
		document.addEventListener('keydown', (e) => {
			if (!this.isVisible) return;
			switch(e.key) {
			case 'ArrowDown':
				e.preventDefault();
				this.currentIndex = Math.min(this.currentIndex + 1, this.filteredNotes.length - 1);
				this.displayNotesList();
				break;
			case 'ArrowUp':
				e.preventDefault();
				this.currentIndex = Math.max(this.currentIndex - 1, 0);
				this.displayNotesList();
				break;
			case 'Enter':
				e.preventDefault();
				this.selectCurrent();
				break;
			case 'Escape':
				this.hideModal();
				break;

			}
		});
	}

	private selectCurrent(): void {
		if (this.currentIndex >= 0 && this.currentIndex < this.filteredNotes.length) {
			const id = this.filteredNotes[this.currentIndex];
			this.onSelectCallback(id);
			this.hideModal();
		}
	}

	public showModal(notesList: string[]): void {		
		this.isVisible = true;
		this.selectionModal.hidden = false;
		this.filterBox.focus();
		this.validNotes = notesList;
		this.filteredNotes = notesList;
		
		this.listContainer.innerHTML = '';

		this.displayNotesList();
	}

	private displayNotesList(): void {
		this.listContainer.innerHTML = '';
		this.filteredNotes.forEach((note, i) => {
			const li = document.createElement('li');
			li.textContent = note;
			if (i == this.currentIndex)  {
				li.classList.add('hovered');
			}
			li.addEventListener('mouseover', () => {
				this.currentIndex = i;
				this.displayNotesList();
			});

			li.addEventListener('click', () => {
				this.onSelectCallback(note);
				this.hideModal();
			});

			this.listContainer.appendChild(li);
		});

		const selected = this.filterBox.querySelector('.hovered') as HTMLElement | null;
		if (selected) selected.scrollIntoView({ block: 'nearest' });
	}

	private hideModal(): void {
		this.isVisible = false;
		this.selectionModal.hidden = true;
	}

	private filterNotes(): void {
		const filter = this.filterBox.value.toLowerCase();
		this.filteredNotes = this.validNotes.filter(n => n.toLowerCase().includes(filter));

		this.currentIndex = this.filteredNotes.length ? 0 : -1;
		this.displayNotesList();
	}

	
}