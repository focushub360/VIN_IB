export const authStore = {
    token: null as string | null,
    mechanicId: null as number | null,
    mechanicName: null as string | null,

    setSession(token: string, mechanicId: number, name: string) {
        this.token = token;
        this.mechanicId = mechanicId;
        this.mechanicName = name;
    },

    clearSession() {
        this.token = null;
        this.mechanicId = null;
        this.mechanicName = null;
    }
};
