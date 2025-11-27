const db = require('../db')

const DEFAULT_LIMIT = 6

const DEFAULT_PRODUCTS = [
    {
        productName: 'Crisp Apples',
        price: 3.49,
        category: 'Produce',
        image: 'apples.png',
        quantity: 120
    },
    {
        productName: 'Sweet Bananas',
        price: 2.19,
        category: 'Produce',
        image: 'bananas.png',
        quantity: 140
    },
    {
        productName: 'Artisan Bread Loaf',
        price: 4.79,
        category: 'Bakery',
        image: 'bread.png',
        quantity: 60
    },
    {
        productName: 'Broccoli Crowns',
        price: 2.59,
        category: 'Produce',
        image: 'broccoli.png',
        quantity: 90
    },
    {
        productName: 'Organic Broccoli Florets',
        price: 3.49,
        category: 'Produce',
        image: 'broccoli2.jpg',
        quantity: 80
    },
    {
        productName: 'Farm Fresh Milk',
        price: 3.29,
        category: 'Dairy',
        image: 'milk.png',
        quantity: 110
    },
    {
        productName: 'Vine Tomatoes',
        price: 2.99,
        category: 'Produce',
        image: 'tomatoes.png',
        quantity: 100
    }
]

let defaultsSeeded = false

class Product {
    static async ensureSeedData() {
        if (defaultsSeeded) {
            return
        }

        const [rows] = await db.query('SELECT COUNT(*) AS count FROM products')
        const count = rows?.[0]?.count || 0

        if (count === 0 && DEFAULT_PRODUCTS.length) {
            const placeholders = DEFAULT_PRODUCTS.map(() => '(?, ?, ?, ?, ?)').join(', ')
            const values = []

            DEFAULT_PRODUCTS.forEach(product => {
                values.push(
                    product.productName,
                    product.price,
                    product.category,
                    product.image,
                    product.quantity
                )
            })

            await db.query(
                `
                    INSERT INTO products (productName, price, category, image, quantity)
                    VALUES ${placeholders}
                `,
                values
            )
        }

        defaultsSeeded = true
    }

    static async findAll(filters = {}) {
        await this.ensureSeedData()

        const params = []
        const clauses = []

        if (filters.search) {
            clauses.push('(productName LIKE ? OR category LIKE ?)')
            params.push(`%${filters.search}%`, `%${filters.search}%`)
        }

        if (filters.category && filters.category !== 'all') {
            clauses.push('category = ?')
            params.push(filters.category)
        }

        if (filters.priceRanges && filters.priceRanges.length) {
            const rangeClauses = []

            filters.priceRanges.forEach(range => {
                if (typeof range.min === 'number' && typeof range.max === 'number') {
                    rangeClauses.push('(price >= ? AND price <= ?)')
                    params.push(range.min, range.max)
                } else if (typeof range.min === 'number') {
                    rangeClauses.push('price >= ?')
                    params.push(range.min)
                } else if (typeof range.max === 'number') {
                    rangeClauses.push('price <= ?')
                    params.push(range.max)
                }
            })

            if (rangeClauses.length) {
                clauses.push(`(${rangeClauses.join(' OR ')})`)
            }
        }

        let sql = 'SELECT * FROM products'
        if (clauses.length) {
            sql += ` WHERE ${clauses.join(' AND ')}`
        }
        let orderBy = 'productName ASC'
        if (filters.sort === 'price-asc') {
            orderBy = 'price ASC'
        } else if (filters.sort === 'price-desc') {
            orderBy = 'price DESC'
        }
        sql += ` ORDER BY ${orderBy}`

        const [rows] = await db.query(sql, params)
        return rows
    }

    static async findFeatured(limit = DEFAULT_LIMIT) {
        await this.ensureSeedData()

        const [rows] = await db.query(
            'SELECT * FROM products ORDER BY quantity DESC, productName ASC LIMIT ?',
            [limit]
        )
        return rows
    }

    static async getCategories() {
        await this.ensureSeedData()

        const [rows] = await db.query(
            'SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category <> "" ORDER BY category'
        )
        return rows.map(row => row.category)
    }

    static async getInventoryStats() {
        await this.ensureSeedData()

        const [rows] = await db.query(`
            SELECT 
                COUNT(*) AS totalProducts,
                SUM(CASE WHEN quantity <= 10 THEN 1 ELSE 0 END) AS lowStock,
                SUM(quantity) AS totalUnits
            FROM products
        `)

        return rows[0] || { totalProducts: 0, lowStock: 0, totalUnits: 0 }
    }

    static async findById(productId) {
        await this.ensureSeedData()

        const [rows] = await db.query(
            'SELECT * FROM products WHERE id = ? LIMIT 1',
            [productId]
        )
        return rows[0] || null
    }

    static async findByIds(productIds = []) {
        await this.ensureSeedData()

        if (!productIds.length) {
            return []
        }

        const placeholders = productIds.map(() => '?').join(', ')
        const [rows] = await db.query(
            `SELECT * FROM products WHERE id IN (${placeholders})`,
            productIds
        )

        const map = new Map(rows.map(row => [Number(row.id), row]))
        return productIds
            .map(id => map.get(Number(id)))
            .filter(Boolean)
    }

    static async create(product) {
        const sql = `
            INSERT INTO products (productName, price, category, image, quantity)
            VALUES (?, ?, ?, ?, ?)
        `
        const payload = [
            product.productName,
            product.price,
            product.category || 'General',
            product.image || 'apples.png',
            product.quantity || 0
        ]

        const [result] = await db.query(sql, payload)
        return { id: result.insertId }
    }

    static async update(productId, updates) {
        const fields = []
        const values = []

        const allowed = ['productName', 'price', 'category', 'image', 'quantity']

        allowed.forEach(field => {
            if (updates[field] !== undefined) {
                fields.push(`${field} = ?`)
                values.push(updates[field])
            }
        })

        if (!fields.length) {
            return { affectedRows: 0 }
        }

        values.push(productId)

        const sql = `
            UPDATE products
            SET ${fields.join(', ')}
            WHERE id = ?
        `

        const [result] = await db.query(sql, values)
        return result
    }

    static async remove(productId) {
        const [result] = await db.query(
            'DELETE FROM products WHERE id = ?',
            [productId]
        )
        return result
    }

    static async ensureStock(items = []) {
        for (const item of items) {
            const product = await this.findById(item.id)
            if (!product) {
                throw new Error(`Product ${item.id} not found`)
            }
            const available = Number(product.quantity) || 0
            if (available < item.quantity) {
                throw new Error(`Only ${available} unit(s) of ${product.productName} available`)
            }
        }
    }

    static async decrementStock(items = []) {
        const connection = await db.getConnection()

        try {
            await connection.beginTransaction()

            for (const item of items) {
                const [rows] = await connection.query(
                    'SELECT quantity FROM products WHERE id = ? FOR UPDATE',
                    [item.id]
                )

                if (!rows.length || rows[0].quantity < item.quantity) {
                    throw new Error('Insufficient stock detected while checking out')
                }

                await connection.query(
                    'UPDATE products SET quantity = quantity - ? WHERE id = ?',
                    [item.quantity, item.id]
                )
            }

            await connection.commit()
        } catch (err) {
            await connection.rollback()
            throw err
        } finally {
            connection.release()
        }
    }
}

module.exports = Product
