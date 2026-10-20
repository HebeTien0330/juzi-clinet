export class AuthSession {

    private static _instance: AuthSession | null = null;

    public static getInstance(): AuthSession {
        if (!AuthSession._instance) {
            AuthSession._instance = new AuthSession();
        }
        return AuthSession._instance;
    }

    private userId: string = "";
    private sessionToken: string = "";
    private clientId: string = "";

    public setLogin(data: { userId: string; sessionToken: string; clientId?: string }): void {
        this.userId = data.userId || "";
        this.sessionToken = data.sessionToken || "";
        if (data.clientId) {
            this.clientId = data.clientId;
        }
    }

    public updateToken(sessionToken: string): void {
        this.sessionToken = sessionToken || "";
    }

    public getUserId(): string {
        return this.userId;
    }

    public getSessionToken(): string {
        return this.sessionToken;
    }

    public getClientId(): string {
        return this.clientId;
    }

    public hasSession(): boolean {
        return !!this.userId && !!this.sessionToken;
    }

    public getReconnectPayload(): { userId: string; sessionToken: string } {
        return {
            userId: this.userId,
            sessionToken: this.sessionToken,
        };
    }

    public clear(): void {
        this.userId = "";
        this.sessionToken = "";
        this.clientId = "";
    }
}

export function getAuthSession(): AuthSession {
    return AuthSession.getInstance();
}
