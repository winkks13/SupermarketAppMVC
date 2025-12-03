const mysql = require('mysql2/promise')
require('dotenv').config()

// Promise-based pool for async/await queries
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'c372_supermarketdb',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true
})

pool.getConnection()
    .then((conn) => {
        console.log('Connected to MySQL database')
        conn.release()
    })
    .catch((err) => {
        console.error('Error connecting to MySQL:', err)
    })

module.exports = pool
