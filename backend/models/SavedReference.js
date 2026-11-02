const mongoose = require('mongoose');

const savedReferenceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    region_name: {
        type: String,
        default: null
    },
    country_name: {
        type: String,
        default: null
    },
    ib_version_name: {
        type: String,
        default: null
    },
    total_records: {
        type: Number,
        required: true,
        default: 0
    },
    parsed_json: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('SavedReference', savedReferenceSchema);
