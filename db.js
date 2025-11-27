const mysql = require('mysql2')
require('dotenv').config()

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'c372_supermarketdb',
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true
})

module.exports = pool.promise()
