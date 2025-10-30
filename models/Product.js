/**
 * Database interface for Product operations
 */

const db = require('../db')

// SQL Query Templates
const SQL = {
    SELECT_ALL:         'SELECT * FROM products',
    SELECT_BY_CATEGORY: 'SELECT * FROM products WHERE category = ?',
    SELECT_BY_ID:       'SELECT * FROM products WHERE productId = ?',
    INSERT:            'INSERT INTO products (productName, price, category, image) VALUES (?, ?, ?, ?)',
    DELETE:            'DELETE FROM products WHERE productId = ?'
}

// Product fields that can be updated
const UPDATABLE_FIELDS = ['productName', 'price', 'category', 'image']

/**
 * Product Model
 * Handles database operations for products
 */
class Product {
    /**
     * Retrieve all products, optionally filtered by category
     */
    static getAllProducts(params, callback) {
        function handleResults(err, results) {
            if (err) {
                return callback(err)
            }
            callback(null, results)
        }

        if (params?.category) {
            db.query(SQL.SELECT_BY_CATEGORY, [params.category], handleResults)
        } else {
            db.query(SQL.SELECT_ALL, [], handleResults)
        }
    }

    /**
     * Find a product by its ID
     */
    static getProductById(productId, callback) {
        function handleResult(err, results) {
            if (err) {
                return callback(err)
            }
            callback(null, results?.[0] || null)
        }

        db.query(SQL.SELECT_BY_ID, [productId], handleResult)
    }

    /**
     * Create a new product
     */
    static addProduct(product, callback) {
        function handleInsert(err, result) {
            if (err) {
                return callback(err)
            }
            callback(null, {
                insertId: result.insertId,
                affectedRows: result.affectedRows
            })
        }

        const { productName, price, category, image } = product || {}
        db.query(SQL.INSERT, [productName, price, category, image], handleInsert)
    }

    /**
     * Update an existing product
     */
    static updateProduct(params, callback) {
        // Validate required parameter
        if (!params?.productId) {
            return callback(new Error('productId is required for update'))
        }

        // Build update fields and values
        const updates = UPDATABLE_FIELDS
            .filter(field => params[field] !== undefined)
            .map(field => ({
                field: field,
                value: params[field]
            }))

        // Handle case when no fields to update
        if (updates.length === 0) {
            return callback(null, { affectedRows: 0 })
        }

        // Construct SQL query
        const sql = `
            UPDATE products 
            SET ${updates.map(u => `${u.field} = ?`).join(', ')}
            WHERE productId = ?
        `

        // Prepare values array
        const values = [
            ...updates.map(u => u.value),
            params.productId
        ]

        function handleUpdate(err, result) {
            if (err) {
                return callback(err)
            }
            callback(null, {
                affectedRows: result.affectedRows,
                changedRows: result.changedRows
            })
        }

        db.query(sql, values, handleUpdate)
    }

    /**
     * Remove a product from the database
     */
    static deleteProduct(productId, callback) {
        function handleDelete(err, result) {
            if (err) {
                return callback(err)
            }
            callback(null, { affectedRows: result.affectedRows })
        }

        db.query(SQL.DELETE, [productId], handleDelete)
    }
}

module.exports = Product
