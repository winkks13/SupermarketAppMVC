/**
 * Product Controller
 * Handles all product-related operations
 */

const Product = require('../models/Product')

class ProductController {
    /**
     * GET /products
     * List all products with optional category filter
     */
    static listAll(req, res) {
        const filters = {}
        
        if (req.query && req.query.category) {
            filters.category = req.query.category
        }
        
        Product.getAllProducts(filters, function handleProducts(err, products) {
            if (err) {
                return res.status(500).send('Failed to load products')
            }
            return res.render('products/list', { products })
        })
    }

    /**
     * GET /products/:id
     * Get a specific product by ID
     */
    static getById(req, res) {
        function handleProduct(err, product) {
            if (err) {
                return res.status(500).send('Failed to load product')
            }
            if (!product) {
                return res.status(404).send('Product not found')
            }
            return res.render('products/detail', { product })
        }

        Product.getProductById(req.params.id, handleProduct)
    }

    /**
     * GET /products/add
     * Show the add product form
     */
    static showAddForm(req, res) {
        return res.render('products/add')
    }

    /**
     * POST /products/add
     * Add a new product
     */
    static add(req, res) {
        function handleAdd(err, info) {
            if (err) {
                return res.status(500).send('Failed to add product')
            }
            return res.redirect('/products')
        }

        const product = {
            productName: req.body.productName,
            price: req.body.price,
            category: req.body.category,
            image: req.body.image
        }

        Product.addProduct(product, handleAdd)
    }

    /**
     * GET /products/:id/edit
     * Show the edit product form
     */
    static showEditForm(req, res) {
        function handleEdit(err, product) {
            if (err) {
                return res.status(500).send('Failed to load product for edit')
            }
            if (!product) {
                return res.status(404).send('Product not found')
            }
            return res.render('products/edit', { product })
        }

        Product.getProductById(req.params.id, handleEdit)
    }

    /**
     * POST /products/:id/edit
     * Update an existing product
     */
    static update(req, res) {
        function handleUpdate(err, info) {
            if (err) {
                return res.status(500).send('Failed to update product')
            }
            return res.redirect('/products')
        }

        const params = {
            productId: req.params.id,
            productName: req.body.productName,
            price: req.body.price,
            category: req.body.category,
            image: req.body.image
        }

        Product.updateProduct(params, handleUpdate)
    }

    /**
     * POST /products/:id/delete
     * Delete a product
     */
    static delete(req, res) {
        function handleDelete(err, info) {
            if (err) {
                return res.status(500).send('Failed to delete product')
            }
            return res.redirect('/products')
        }

        Product.deleteProduct(req.params.id, handleDelete)
    }
}

module.exports = ProductController
