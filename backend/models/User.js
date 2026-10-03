const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const User = sequelize.define('User', {
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    plain_password: {
        type: DataTypes.STRING,
        allowNull: true // Optional, only for tenants/mechanics we want to view
    },
    role: {
        type: DataTypes.ENUM('super_admin', 'tenant', 'mechanic', 'sub_tenant'),
        allowNull: false
    },
    // For mechanics, this points to their Tenant. For Tenants, this points to Super Admin (optional).
    parentId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    permissions: {
        type: DataTypes.JSON, // { viewMechanics: true, viewVin: false, ... }
        allowNull: true
    }
});

module.exports = User;
