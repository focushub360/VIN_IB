const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const SurveyResponse = sequelize.define('SurveyResponse', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    upload_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    row_index: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    vin: {
        type: DataTypes.STRING,
        allowNull: true
    },
    stamped_vin: {
        type: DataTypes.STRING,
        allowNull: true
    },
    survey_date: {
        type: DataTypes.STRING,
        allowNull: true
    },
    surveyor_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    user_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    nps_score: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    sentiment: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Valid'
    },
    full_data: {
        type: DataTypes.JSON, // Stores column letters mapping: { A: "...", T: "...", EP: "Yes" }
        allowNull: true,
        defaultValue: {}
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ['upload_id'] },
        { fields: ['upload_id', 'row_index'] }
    ]
});

module.exports = SurveyResponse;
