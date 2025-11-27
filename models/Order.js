const db = require('../db')

const parseItems = (order = {}) => {
    try {
        return JSON.parse(order.orderItems || '[]')
    } catch (err) {
        return []
    }
}

const VALID_STATUSES = ['PAID', 'FULFILLED', 'CANCELLED', 'CASH_ON_DELIVERY']

class Order {
    static async create(order) {
        const sql = `
            INSERT INTO orders (
                userId,
                orderItems,
                subtotal,
                tax,
                total,
                shippingAddress,
                paymentMethod,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `

        const resolvedPayment = order.paymentMethod || 'card'
        const resolvedStatus = VALID_STATUSES.includes(order.status)
            ? order.status
            : (resolvedPayment === 'cash' ? 'CASH_ON_DELIVERY' : 'PAID')

        const payload = [
            order.userId,
            JSON.stringify(order.items || []),
            order.subtotal,
            order.tax,
            order.total,
            order.shippingAddress,
            resolvedPayment,
            resolvedStatus
        ]

        const [result] = await db.query(sql, payload)
        return { id: result.insertId }
    }

    static async countByUser(userId) {
        const [rows] = await db.query(
            'SELECT COUNT(*) AS total FROM orders WHERE userId = ?',
            [userId]
        )
        return rows[0]?.total || 0
    }

    static async findByUser(userId) {
        const [rows] = await db.query(
            `
            SELECT
                o.*,
                u.username AS customerName,
                u.email AS customerEmail
            FROM orders o
            LEFT JOIN users u ON u.id = o.userId
            WHERE o.userId = ?
            ORDER BY o.createdAt DESC
            `,
            [userId]
        )

        return rows.map(order => ({
            ...order,
            items: parseItems(order)
        }))
    }

    static async findAll() {
        const [rows] = await db.query(
            `
            SELECT
                o.*,
                u.username AS customerName,
                u.email AS customerEmail
            FROM orders o
            LEFT JOIN users u ON u.id = o.userId
            ORDER BY o.createdAt DESC
            `
        )

        return rows.map(order => ({
            ...order,
            items: parseItems(order)
        }))
    }

    static async updateStatus(orderId, status) {
        if (!VALID_STATUSES.includes(status)) {
            throw new Error('Invalid order status')
        }

        const [result] = await db.query(
            'UPDATE orders SET status = ? WHERE id = ?',
            [status, orderId]
        )

        return result
    }
}

module.exports = Order
