const db = require('../db')

const clampRating = (value) => {
    const num = Number(value) || 0
    return Math.min(5, Math.max(1, num))
}

class Review {
    static async create({ productId, userId, rating = 5, comment = '' }) {
        const payload = [
            Number(productId),
            Number(userId),
            clampRating(rating),
            comment.trim()
        ]

        const [result] = await db.query(
            `
            INSERT INTO reviews (productId, userId, rating, comment)
            VALUES (?, ?, ?, ?)
            `,
            payload
        )

        return { id: result.insertId }
    }

    static async findByProduct(productId) {
        const [rows] = await db.query(
            `
            SELECT r.*, u.username
            FROM reviews r
            LEFT JOIN users u ON u.id = r.userId
            WHERE r.productId = ?
            ORDER BY r.createdAt DESC
            `,
            [productId]
        )

        return rows || []
    }

    static async getSummaryByProductIds(productIds = []) {
        if (!productIds.length) {
            return {}
        }

        const placeholders = productIds.map(() => '?').join(', ')
        const [rows] = await db.query(
            `
            SELECT productId, AVG(rating) AS avgRating, COUNT(*) AS reviewCount
            FROM reviews
            WHERE productId IN (${placeholders})
            GROUP BY productId
            `,
            productIds
        )

        const map = {}
        rows.forEach(row => {
            map[row.productId] = {
                avgRating: Number(row.avgRating),
                reviewCount: Number(row.reviewCount)
            }
        })
        return map
    }
}

module.exports = Review
