const Product = require('../models/Product')
const { getCart, calculateTotals, clearCart } = require('./cartUtils')

class CartController {
    static async addItem(req, res) {
        try {
            const requestedQty = Math.max(1, Number(req.body.quantity) || 1)
            const productId = Number(req.params.productId)
            const product = await Product.findById(productId)

            if (!product) {
                req.flash('error', 'Product not found.')
                return res.redirect('/shop')
            }

            const availableQty = Math.max(0, Number(product.quantity) || 0)

            if (!availableQty) {
                req.flash('error', 'This product is out of stock.')
                return res.redirect('/shop')
            }

            const quantity = Math.min(requestedQty, availableQty)

            if (availableQty < requestedQty) {
                req.flash('error', `Only ${availableQty} unit(s) left in stock.`)
            }

            const cart = getCart(req.session)
            const resolvedId = Number(product.id)
            const existing = cart.items.find(item => item.id === resolvedId)

            if (existing) {
                existing.quantity = Math.min(existing.quantity + quantity, availableQty)
            } else {
                cart.items.push({
                    id: resolvedId,
                    productName: product.productName,
                    price: Number(product.price),
                    quantity,
                    image: product.image
                })
            }

            calculateTotals(cart)
            req.flash('success', `${product.productName} added to cart.`)
            res.redirect('/cart')
        } catch (err) {
            console.error(err)
            req.flash('error', 'Unable to add product to cart.')
            res.redirect('/shop')
        }
    }

    static async viewCart(req, res) {
        const cart = getCart(req.session)

        try {
            const productIds = cart.items.map(item => item.id)
            const products = await Promise.all(productIds.map(id => Product.findById(id)))
            const productMap = new Map()
            products.forEach(product => {
                if (product && product.id) {
                    productMap.set(Number(product.id), product)
                }
            })

            cart.items = cart.items.map(item => {
                const available = Math.max(0, Number(productMap.get(item.id)?.quantity) || 0)
                return { ...item, available }
            })

            calculateTotals(cart)

            res.render('cart', {
                pageTitle: 'Your cart',
                cart
            })
        } catch (err) {
            console.error(err)
            req.flash('error', 'Unable to load your cart right now.')
            res.redirect('/shop')
        }
    }

    static async updateItem(req, res) {
        const cart = getCart(req.session)
        const requestedQty = Math.max(1, Number(req.body.quantity) || 1)
        const productId = Number(req.params.productId)

        const item = cart.items.find(i => i.id === productId)
        if (!item) {
            req.flash('error', 'Item not found in cart.')
            return res.redirect('/cart')
        }

        try {
            const product = await Product.findById(productId)
            const available = Math.max(0, Number(product?.quantity) || 0)

            if (!product || available === 0) {
                req.flash('error', 'This product is no longer available.')
                cart.items = cart.items.filter(i => i.id !== productId)
            } else if (available < requestedQty) {
                item.quantity = available
                req.flash('error', `Only ${available} unit(s) left. Quantity adjusted.`)
            } else {
                item.quantity = requestedQty
                req.flash('success', 'Cart updated.')
            }
        } catch (err) {
            console.error(err)
            req.flash('error', 'Unable to update cart right now.')
        }

        calculateTotals(cart)
        res.redirect('/cart')
    }

    static removeItem(req, res) {
        const cart = getCart(req.session)
        const productId = Number(req.params.productId)

        cart.items = cart.items.filter(item => item.id !== productId)
        calculateTotals(cart)

        req.flash('success', 'Item removed from cart.')
        res.redirect('/cart')
    }

    static emptyCart(req, res) {
        clearCart(req.session)
        req.flash('success', 'Cart cleared.')
        res.redirect('/cart')
    }
}

module.exports = CartController
