
const mongoose = require('mongoose');

const InspectionSchema = new mongoose.Schema({
    vin: {
        type: String,
        required: true
    },
    vinImage: {
        type: String,
        default: null
    },
    gpsImage: {
        type: String,
        default: null
    },
    faultImage: {
        type: String,
        default: null
    },
    gpsData: {
        type: mongoose.Schema.Types.Mixed,   // stores lat, long, time, address
        default: {}
    },
    mechanicId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Inspection', InspectionSchema);