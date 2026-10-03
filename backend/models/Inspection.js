const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Inspection = sequelize.define('Inspection', {
    vin: {
        type: DataTypes.STRING,
        allowNull: false
    },
    vinImage: {
        type: DataTypes.STRING,
        allowNull: true
    },
    gpsImage: {
        type: DataTypes.STRING,
        allowNull: true
    },
    faultImage: {
        type: DataTypes.STRING,
        allowNull: true
    },
    gpsData: {
        type: DataTypes.JSON, // Stores lat, long, time, address
        allowNull: true
    },
    mechanicId: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
});

module.exports = Inspection;
