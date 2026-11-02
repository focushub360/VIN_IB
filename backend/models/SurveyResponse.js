const mongoose = require('mongoose');

const surveyResponseSchema = new mongoose.Schema({
    upload_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UploadedFile',
        required: true
    },
    row_index: {
        type: Number,
        required: true,
        default: 0
    },
    vin: {
        type: String,
        default: null
    },
    stamped_vin: {
        type: String,
        default: null
    },
    survey_date: {
        type: String,
        default: null
    },
    surveyor_name: {
        type: String,
        default: null
    },
    user_name: {
        type: String,
        default: null
    },
    nps_score: {
        type: Number,
        default: null
    },
    sentiment: {
        type: String,
        default: null
    },
    status: {
        type: String,
        required: true,
        default: 'Valid'
    },
    full_data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

surveyResponseSchema.index({ upload_id: 1 });
surveyResponseSchema.index({ upload_id: 1, row_index: 1 });

module.exports = mongoose.model('SurveyResponse', surveyResponseSchema);
