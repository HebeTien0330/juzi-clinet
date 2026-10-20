export interface Params {
    [param: string]: any;
}

export class Event {

    public eventName: string;
    private _evtId: number;
    private _callback: Function;
    private _filter?: Function;

    constructor(evtId: number, eventName: string, callback: Function, filter?: Function) {
        this._evtId = evtId;
        this.eventName = eventName;
        this._callback = callback;
        this._filter = filter;
    }

    public get evtId(): number {
        return this._evtId;
    }

    public execute(args: Params): void {
        if (this._filter && !this._filter(args)) {
            return;
        }
        this._callback(args);
    }
}
