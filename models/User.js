const db = require('../db')

class User {
    static async create(user) {
        const sql = `
            INSERT INTO users (username, email, password, address, contact, role, walletBalance)
            VALUES (?, ?, SHA1(?), ?, ?, ?, ?)
        `

        const payload = [
            user.username,
            user.email,
            user.password,
            user.address,
            user.contact,
            user.role || 'user',
            user.walletBalance || 0
        ]

        const [result] = await db.query(sql, payload)
        return { id: result.insertId }
    }

    static async findByEmail(email) {
        const [rows] = await db.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email])
        return rows[0] || null
    }

    static async authenticate(email, password) {
        const [rows] = await db.query(
            'SELECT * FROM users WHERE email = ? AND password = SHA1(?) LIMIT 1',
            [email, password]
        )

        return rows[0] || null
    }

    static async findById(userId) {
        const [rows] = await db.query(
            'SELECT * FROM users WHERE id = ? LIMIT 1',
            [userId]
        )

        return rows[0] || null
    }

    static async findAll() {
        const [rows] = await db.query(
            'SELECT id, username, email, address, contact, role, createdAt FROM users ORDER BY createdAt DESC'
        )
        return rows
    }

    static async update(userId, updates = {}, options = {}) {
        const fields = []
        const values = []

        const allowed = ['username', 'email', 'address', 'contact']
        if (options.allowRole) {
            allowed.push('role')
        }

        allowed.forEach(field => {
            if (updates[field] !== undefined) {
                fields.push(`${field} = ?`)
                values.push(updates[field])
            }
        })

        if (updates.password) {
            fields.push('password = SHA1(?)')
            values.push(updates.password)
        }

        if (!fields.length) {
            return { affectedRows: 0 }
        }

        values.push(userId)

        const [result] = await db.query(
            `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
            values
        )

        return result
    }

    static async addWalletBalance(userId, amount) {
        const [result] = await db.query(
            'UPDATE users SET walletBalance = COALESCE(walletBalance, 0) + ? WHERE id = ?',
            [amount, userId]
        )
        return result
    }

    static async deductWalletBalance(userId, amount) {
        const [result] = await db.query(
            `UPDATE users
            SET walletBalance = COALESCE(walletBalance, 0) - ?
            WHERE id = ? AND COALESCE(walletBalance, 0) >= ?`,
            [amount, userId, amount]
        )
        return result
    }
}

module.exports = User
