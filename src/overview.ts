import { Entry } from './entry';
import { Note } from './note';

export class Overview extends Note {
	public overviewEntries: Entry[] = [];
	public earliestDate: string;
	public currentDate: string;
	private selectedDateRange: DateRange;
	private aggregatedEntries: EntriesByDay;
	private selectedNoteId?: string;

	public constructor(allEntries: EntryWithSource[]) {
		super('Overview'); // Creates a note with the hard-set title "overview"
		this.id = '.'+this.id; // force a . in front of title for file reasons
		this.currentDate = DateRange.convertFromDate(new Date());
		this.selectedDateRange = new DateRange(new Date());
		this.aggregatedEntries = Overview.collateEntries(allEntries);
		this.earliestDate = Object.keys(this.aggregatedEntries).sort()[0] || this.currentDate;
		this.isPersistentTextUnsaved = false;
		this.isEntriesUnsaved = false;
	}

	private static collateEntries(allEntries: EntryWithSource[]): EntriesByDay {
		const sortedEntries: EntryWithSource[] = [...allEntries].sort((a, b) =>
			a.entry.created.getTime() - b.entry.created.getTime(),
		);
		const aggregatedEntries: EntriesByDay = {};
		let nextDisplayGroupId = -1;
		let previousEntryWrapper: EntryWithSource | null = null;

		for (const entryWrapper of sortedEntries) {
			const currentEntry = entryWrapper.entry;
			const day = DateRange.convertFromDate(entryWrapper.entry.created);
			if (!aggregatedEntries[day]) aggregatedEntries[day] = [];

			let isNewGroup = false;

			if (!previousEntryWrapper) {
				isNewGroup = true;
			} else {
				const previousEntry = previousEntryWrapper.entry;
				
				if (entryWrapper.sourceNoteId != previousEntryWrapper.sourceNoteId || currentEntry.groupId != previousEntry.groupId) {
					isNewGroup = true;
				}
			}

			const clonedEntry: Entry = Entry.fromPartial({...currentEntry});
			if (isNewGroup) nextDisplayGroupId++;
			clonedEntry.groupId = nextDisplayGroupId;

			aggregatedEntries[day].push(clonedEntry);
			previousEntryWrapper = entryWrapper;
		}
		return aggregatedEntries
	}

	public addEntry(newEntry: Entry): void {
		this.overviewEntries.push(newEntry);
		this.updateEntriesShown();
	}

	public clearEntries(): void {
		this.entries = [];
	}

	public updateEntries(allEntries: EntryWithSource[]) { // Collects all entries and parses them
		this.overviewEntries.forEach(entry => {
			const newEntryWrapper: EntryWithSource = { entry: entry, sourceNoteId: this.id };
			allEntries.push(newEntryWrapper); // Adds its own entries to the collated entry thing
		});
		this.aggregatedEntries = Overview.collateEntries(allEntries);
		this.updateEntriesShown();
	}

	private updateEntriesShown() { // Actually figures out what to display
		this.clearEntries();
		const startKey: string = this.selectedDateRange.start;
		const endKey:string = this.selectedDateRange.end ?? startKey;

		for (const day in this.aggregatedEntries) {
			if (day >= startKey && day <= endKey) {
				this.entries.push(...this.aggregatedEntries[day]);
			}
		}
	}

	public updateSelectedDate(newDateStart: Date, newDateEnd?: Date): boolean {
		const newDateRange: DateRange = new DateRange(newDateStart, newDateEnd);
		if (newDateRange.start >= this.earliestDate && newDateRange.end || newDateRange.start <= this.currentDate) {
			this.selectedDateRange = newDateRange; // TODO: allow range clipping
			return true;
		} else {
			return false;
		}
	}

	public stepForward(): boolean { // Returns a value true/false if the corresponding button should be greyed out
		this.selectedDateRange.stepDateRange(this.selectedDateRange.range);

		if (this.selectedDateRange.end || this.selectedDateRange.start >= this.currentDate) {
			return true;
		} else {
			return false;
		}
	}

	public stepBackward(): boolean {
		this.selectedDateRange.stepDateRange(-this.selectedDateRange.range);

		if (this.selectedDateRange.start <= this.earliestDate) {
			return true;
		} else {
			return false;
		}
	}
}

class DateRange {
	public start: string;
	public end?: string;
	public range: number = 1;

	public constructor(start: Date, end?: Date) {
		this.start = DateRange.convertFromDate(start)
		if (end) {
			this.end = DateRange.convertFromDate(end);
			this.range = DateRange.daysBetweenDates(start, end);
		}
	}

	public static addDaysToDates(date: string, days: number): Date {
		const result = new Date(
			parseInt(date.slice(0, 4)),
			parseInt(date.slice(4, 6)) - 1,
			parseInt(date.slice(6, 8)),
		);
		result.setDate(result.getDate() + days);

		return result;
	}

	public static daysBetweenDates(start: Date, end: Date): number {
    	return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
	}

	public static convertFromDate(date: Date): string {
		return (date.toISOString().slice(0, 10).replace(/-/g, ''));
	}

	public stepDateRange(days: number) {
		this.start = DateRange.convertFromDate(DateRange.addDaysToDates(this.start, days));
		if (this.end) this.end = DateRange.convertFromDate(DateRange.addDaysToDates(this.end, days));
	}
}

interface EntriesByDay {
	[yyyyMMdd: string]: Entry[];
}

export interface EntryWithSource {
	entry: Entry;
	sourceNoteId: string;
}