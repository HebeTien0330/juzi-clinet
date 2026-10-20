import { resources, JsonAsset } from "cc"

export class TableManager {

    private _basePath = "./tables/";
    private loadedTables: any = {};

    queryFromLoaded(name: string) {
        return this.loadedTables[name];
    }

    appendToLoaded(name: string, table: any) {
        if (this.loadedTables[name]) {
            console.log("table name conflict");
            return;
        }
        this.loadedTables[name] = table;
    }

    getTable(name: string, func: Function) {
        let table = this.queryFromLoaded(name);
        if (table != null) {
            func(table);
            return;
        }
        const tablePath = `${this._basePath}${name}`;
        resources.load(tablePath, JsonAsset, (err, data) => {
            if (err || !data) {
                func(null);
                return;
            }
            table = data["json"];
            this.appendToLoaded(name, table);
            func(data["json"]);
        });
    }

    async fetchTable(name: string, path?: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let table = this.queryFromLoaded(name);
            if (table == null) {
                const tablePath = `${this._basePath}${name}`;
                resources.load(tablePath, JsonAsset, (err, data) => {
                    if (err || !data) {
                        return resolve({ err: err, res: null });
                    }
                    table = data.json;
                    this.appendToLoaded(name, table);
                    const res = this.match(table, path);
                    return resolve({ err: null, res });
                });
            } else {
                return resolve({ err: null, res: this.match(table, path) });
            }
        });
    }

    match(data: any, path?: string) {
        if (path == null) {
            return data;
        }
        path = String(path);
        const keys = path.split(".");
        for (const key of keys) {
            data = data[key];
            if (data === undefined) {
                return null;
            }
        }
        return data;
    }
}
