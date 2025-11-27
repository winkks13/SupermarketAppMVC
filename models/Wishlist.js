const db = require('../db')

class Wishlist {
    static async add(userId, productId) {
        await db.query(
            `
            INSERT IGNORE INTO wishlists (userId, productId)
            VALUES (?, ?)
            `,
            [Number(userId), Number(productId)]
        )
    }

    static async remove(userId, productId) {
        await db.query(
            'DELETE FROM wishlists WHERE userId = ? AND productId = ?',
            [Number(userId), Number(productId)]
        )
    }

    static async getProductIdsForUser(userId) {
        const [rows] = await db.query(
            'SELECT productId FROM wishlists WHERE userId = ?',
            [Number(userId)]
        )
        return rows.map(row => Number(row.productId))
    }
}

module.exports = Wishlist
