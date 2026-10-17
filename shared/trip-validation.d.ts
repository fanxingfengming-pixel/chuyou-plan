export interface DateContext {dateMode:string;departureDate:string;returnDate?:string}
export interface DetailsContext extends DateContext {originCity:string;destinationCity:string;fuzzyDateText:string;tripDays:number;adults:number;children:number}
export function validDate(value:unknown):boolean;
export function beijingToday(now?:Date):string;
export function liveDateError(d:DateContext,now?:Date):string;
export function detailsIssue(d:DetailsContext):{field:string;message:string}|null;
