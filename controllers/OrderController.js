const Product = require('../models/Product')
const Order = require('../models/Order')
const { getCart, calculateTotals, clearCart } = require('../utils/cart')

const getUserId = (user = {}) => user?.id
const ALLOWED_STATUSES = ['PAID', 'FULFILLED', 'CANCELLED', 'CASH_ON_DELIVERY']

class OrderController {
    static showCheckout(req, res) {
        const cart = getCart(req.session)
        calculateTotals(cart)

        if (!cart.items.length) {
            req.flash('error', 'Your cart is empty.')
            return res.redirect('/shop')
        }

        calculateTotals(cart)

        res.render('checkout/index', {
            pageTitle: 'Checkout',
            cart
        })
    }

    static async processCheckout(req, res) {
        const cart = getCart(req.session)

        if (!cart.items.length) {
            req.flash('error', 'Your cart is empty.')
            return res.redirect('/shop')
        }

        try {
            const userId = Number(getUserId(req.session.user))
            const requiredFields = ['addressLine1', 'city', 'postalCode']
            const hasShippingInBody = requiredFields.every(field => req.body[field])

            if (!hasShippingInBody && !req.session.pendingCheckout) {
                req.flash('error', 'Please complete your shipping information.')
                return res.redirect('/checkout')
            }

            const shippingAddress = req.session.pendingCheckout?.shippingAddress || [
                req.body.addressLine1,
                req.body.addressLine2,
                req.body.city,
                req.body.postalCode
            ].filter(Boolean).join(', ')

            if (!shippingAddress) {
                req.flash('error', 'Please complete your shipping information.')
                return res.redirect('/checkout')
            }

            const paymentMethod = (req.body.paymentMethod || req.session.pendingCheckout?.paymentMethod) === 'cash' ? 'cash' : 'card'

            // Stage 1: card selected but no card details yet -> render card form
            if (paymentMethod === 'card' && !req.body.cardNumber) {
                req.session.pendingCheckout = {
                    shippingAddress,
                    paymentMethod
                }

                return res.render('checkout/card', {
                    pageTitle: 'Card payment',
                    cart,
                    shippingAddress
                })
            }

            const status = paymentMethod === 'cash' ? 'CASH_ON_DELIVERY' : 'PAID'

            await Product.ensureStock(cart.items)
            await Product.decrementStock(cart.items)

            const priorOrders = await Order.countByUser(userId)
            const orderNumber = priorOrders + 1

            const order = await Order.create({
                userId,
                items: cart.items,
                subtotal: cart.totals.subtotal,
                tax: cart.totals.tax,
                total: cart.totals.total,
                shippingAddress,
                paymentMethod,
                status
            })

            clearCart(req.session)
            req.session.pendingCheckout = null
            req.flash('success', `Order #${orderNumber} placed successfully!`)
            res.redirect('/orders/history')
        } catch (err) {
            console.error(err)
            req.flash('error', err.message || 'Unable to process checkout.')
            res.redirect('/checkout')
        }
    }

    static async history(req, res) {
        try {
            const sessionUserId = Number(getUserId(req.session.user))
            const requestedUserId = Number(req.query.userId)

            // Prevent viewing another user's orders via query manipulation
            if (requestedUserId && requestedUserId !== sessionUserId) {
                req.flash('error', 'You can only view your own orders.')
                return res.redirect('/shop')
            }

            const orders = await Order.findByUser(sessionUserId)
            const ordersWithDisplay = orders.map((order, index) => ({
                ...order,
                displayNumber: orders.length - index
            }))
            res.render('orders/history', {
                pageTitle: 'Your orders',
                orders: ordersWithDisplay
            })
        } catch (err) {
            console.error(err)
            req.flash('error', 'Unable to load your orders.')
            res.redirect('/')
        }
    }

    static async adminList(_req, res) {
        try {
            const orders = await Order.findAll()
            res.render('orders/manage', {
                pageTitle: 'Orders dashboard',
                orders
            })
        } catch (err) {
            console.error(err)
            req.flash('error', 'Unable to load orders.')
            res.redirect('/inventory')
        }
    }

    static async updateStatus(req, res) {
        try {
            const nextStatus = req.body.status
            if (!ALLOWED_STATUSES.includes(nextStatus)) {
                throw new Error('Invalid status selected.')
            }

            await Order.updateStatus(req.params.orderId, nextStatus)
            req.flash('success', 'Order status updated.')
        } catch (err) {
            console.error(err)
            req.flash('error', err.message || 'Unable to update order status.')
        }

        res.redirect('/orders/manage')
    }
}

module.exports = OrderController
