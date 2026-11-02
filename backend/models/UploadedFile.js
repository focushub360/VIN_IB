const mongoose = require('mongoose');

const uploadedFileSchema = new mongoose.Schema({
    file_name: {
        type: String,
        required: true
    },
    region_name: {
        type: String,
        required: true,
        default: 'General'
    },
    country_name: {
        type: String,
        required: true,
        default: 'General'
    },
    ib_version_name: {
        type: String,
        required: true,
        default: 'IB 1.0'
    },
    brand_model_name: {
        type: String,
        default: 'General'
    },
    total_records: {
        type: Number,
        required: true,
        default: 0
    },
    status: {
        type: String,
        required: true,
        default: 'processed'
    },
    is_common: {
        type: Boolean,
        required: true,
        default: true
    },
    parsed_json: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    file_path: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('UploadedFile', uploadedFileSchema);
