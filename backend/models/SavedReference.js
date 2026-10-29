const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const SavedReference = sequelize.define('SavedReference', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    region_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    country_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    ib_version_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    total_records: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    parsed_json: {
        type: DataTypes.JSON, // Stores { columns: [...], rows: [...] }
        allowNull: true
    }
}, {
    timestamps: true
});

module.exports = SavedReference;
