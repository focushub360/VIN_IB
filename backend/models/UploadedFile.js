const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const UploadedFile = sequelize.define('UploadedFile', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    file_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    region_name: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'General'
    },
    country_name: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'General'
    },
    ib_version_name: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'IB 1.0'
    },
    total_records: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'processed'
    },
    is_common: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    parsed_json: {
        type: DataTypes.JSON, // Stores { columns: [...], rows: [...] }
        allowNull: true
    },
    file_path: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    timestamps: true
});

module.exports = UploadedFile;
