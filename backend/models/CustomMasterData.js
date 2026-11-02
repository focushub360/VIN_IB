const mongoose = require('mongoose');

const CustomMasterDataSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['regions', 'countries', 'ibVersions', 'brandModels']
    },
    value: {
        type: String,
        required: true
    }
}, { timestamps: true });

// Ensure no duplicates for the same type
CustomMasterDataSchema.index({ type: 1, value: 1 }, { unique: true });

module.exports = mongoose.model('CustomMasterData', CustomMasterDataSchema);