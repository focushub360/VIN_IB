export interface GPSData {
    lat: number;
    long: number;
    time: string;
}

export const inspectionStore = {
    vin: '',
    vinImage: null as string | null,
    gpsImage: null as string | null,
    faultImage: null as string | null,
    gpsData: null as GPSData | null,

    // Method to update data
    update(data: Partial<typeof inspectionStore>) {
        Object.assign(this, data);
    },

    reset() {
        this.vin = '';
        this.vinImage = null;
        this.gpsImage = null;
        this.faultImage = null;
        this.gpsData = null;
    },

    // Helper to getting a snapshot (though direct access works for mutable singleton)
    getSnapshot() {
        return {
            vin: this.vin,
            vinImage: this.vinImage,
            gpsImage: this.gpsImage,
            faultImage: this.faultImage,
            gpsData: this.gpsData,
        };
    }
};
