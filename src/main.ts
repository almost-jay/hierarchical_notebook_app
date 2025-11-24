/* eslint-disable */
// @ts-nocheck
import { UIManager } from './ui-manager';

const uiManager = new UIManager();
await uiManager.initialiseAsync();

const OriginalDate = Date;

function logIfDate(obj: any, label: string) {
    if (obj instanceof OriginalDate) {
        const h = obj.getHours().toString().padStart(2, '0');
        const m = obj.getMinutes().toString().padStart(2, '0');
        const s = obj.getSeconds().toString().padStart(2, '0');
        const ms = obj.getMilliseconds().toString().padStart(3, '0');
        console.log(`[${label}] Date: ${obj.toLocaleString()} | Time: ${h}:${m}:${s}.${ms}`);
    }
}

// Override Date constructor
Date = function (...args: any[]) {
    let date;
    if (args.length === 0) {
        date = new OriginalDate();
    } else {
        date = new (Function.prototype.bind.apply(OriginalDate, [null, ...args]))();
    }
    logIfDate(date, 'new Date');
    return date;
} as unknown as DateConstructor;

// Preserve static methods
Date.now = OriginalDate.now;
Date.parse = OriginalDate.parse;
Date.UTC = OriginalDate.UTC;
Date.prototype = OriginalDate.prototype;

// List of mutating methods to override
const mutators = [
    'setDate', 'setFullYear', 'setHours', 'setMilliseconds', 'setMinutes',
    'setMonth', 'setSeconds', 'setTime', 'setUTCDate', 'setUTCFullYear',
    'setUTCHours', 'setUTCMilliseconds', 'setUTCMinutes', 'setUTCMonth',
    'setUTCSeconds', 'setYear'
];

// Patch each mutator to log after update
mutators.forEach(method => {
    const original = OriginalDate.prototype[method];
    Date.prototype[method] = function (...args: any[]) {
        const result = original.apply(this, args);
        logIfDate(this, `Date.${method}`);
        return result;
    };
});