import { Entry } from "./entry";
import { Note } from "./note";

export class Overview extends Note {
	earliestDate: string;
	currentDate: string;
	selectedDateRange: DateRange;
	overviewEntries: Entry[] = [];
	aggregatedEntries: EntriesByDay;
	selectedNoteId?: string;

	constructor(allEntries: Entry[]) {
		super("Overview"); // Creates a note with the hard-set title "overview"
		this.id = "."+this.id; // force a . in front of title for file reasons
		this.currentDate = DateRange.convertFromDate(new Date());
		this.selectedDateRange = new DateRange(new Date());
		this.aggregatedEntries = Overview.collateNotes(allEntries);
		this.earliestDate = Object.keys(this.aggregatedEntries).sort()[0] || this.currentDate;
	}

	public addEntry(newEntry: Entry): void {
		this.overviewEntries.push(newEntry);
		this.updateEntriesShown();
	}

	public clearEntries(): void {
		this.entries = [];
	}

	updateEntries(allEntries: Entry[]) { // Collects all entries and parses them
		allEntries.push(...this.overviewEntries);
		this.aggregatedEntries = Overview.collateNotes(allEntries);
	}

	updateEntriesShown() { // Actually figures out what to display
		this.clearEntries();
		const startKey = this.selectedDateRange.start;
		const endKey = this.selectedDateRange.end ?? startKey;

		for (const day in this.aggregatedEntries) {
			if (day >= startKey && day <= endKey) {
				this.entries.push(...this.aggregatedEntries[day]);
			}
		}
	}

	updateSelectedDate(newDateStart: Date, newDateEnd?: Date): boolean {
		const newDateRange = new DateRange(newDateStart, newDateEnd);
		if (newDateRange.start >= this.earliestDate && newDateRange.end || newDateRange.start <= this.currentDate) {
			this.selectedDateRange = newDateRange; // TODO: allow range clipping
			return true;
		} else {
			return false;
		}
	}

	stepForward(): boolean { // Returns a value true/false if the corresponding button should be greyed out
		this.selectedDateRange.stepDateRange(this.selectedDateRange.range);

		if (this.selectedDateRange.end || this.selectedDateRange.start >= this.currentDate) {
			return true;
		} else {
			return false;
		}
	}

	stepBackward(): boolean {
		this.selectedDateRange.stepDateRange(-this.selectedDateRange.range);

		if (this.selectedDateRange.start <= this.earliestDate) {
			return true;
		} else {
			return false;
		}
	}
	
	static collateNotes(allEntries: Entry[]): EntriesByDay {
		let aggregatedEntries: EntriesByDay = {};
		for (const entry of allEntries) {
			const key = DateRange.convertFromDate(entry.created);
			if (!aggregatedEntries[key]) aggregatedEntries[key] = [];
			aggregatedEntries[key].push(entry);
		}
		return aggregatedEntries;
	}
}

class DateRange {
	start: string;
	end?: string;
	range: number = 1;

	constructor(start: Date, end?: Date) {
		this.start = DateRange.convertFromDate(start)
		if (end) {
			this.end = DateRange.convertFromDate(end);
			this.range = DateRange.daysBetweenDates(start, end);
		}
	}

	stepDateRange(days: number) {
		this.start = DateRange.convertFromDate(DateRange.addDaysToDates(this.start, days));
		if (this.end) this.end = DateRange.convertFromDate(DateRange.addDaysToDates(this.end, days));
	}

	static addDaysToDates(date: string, days: number): Date {
		const result = new Date(
			parseInt(date.slice(0, 4)),
			parseInt(date.slice(4, 6)) - 1,
			parseInt(date.slice(6, 8))
		);
		result.setDate(result.getDate() + days);

		return result;
	}

	static daysBetweenDates(start: Date, end: Date): number {
    	return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
	}

	static convertFromDate(date: Date): string {
		return (date.toISOString().slice(0, 10).replace(/-/g, ""));
	}
}

interface EntriesByDay {
	[yyyyMMdd: string]: Entry[];
}