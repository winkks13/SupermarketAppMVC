const Product = require('../models/Product')
const Order = require('../models/Order')
const { createOrder, captureOrder } = require('../services/paypal')
const { getCart, calculateTotals, clearCart } = require('./cartUtils')

const getUserId = (user = {}) => user?.id

async function finalizeOrderFromSession(req) {
    const cart = getCart(req.session)
    calculateTotals(cart)

    if (!cart.items.length) {
        throw new Error('Your cart is empty.')
    }

    const userId = Number(getUserId(req.session.user))
    const shippingAddress = req.session.pendingCheckout?.shippingAddress

    if (!shippingAddress) {
        throw new Error('Shipping information is missing.')
    }

    await Product.ensureStock(cart.items)
    await Product.decrementStock(cart.items)

    const priorOrders = await Order.countByUser(userId)
    const orderNumber = priorOrders + 1

    await Order.create({
        userId,
        items: cart.items,
        subtotal: cart.totals.subtotal,
        tax: cart.totals.tax,
        total: cart.totals.total,
        shippingAddress,
        paymentMethod: 'paypal',
        status: 'PAID'
    })

    clearCart(req.session)
    req.session.pendingCheckout = null

    return { orderNumber }
}

class PayPalController {
    static showCheckout(req, res) {
        const cart = getCart(req.session)
        calculateTotals(cart)
        const shippingAddress = req.session.pendingCheckout?.shippingAddress

        if (!cart.items.length) {
            req.flash('error', 'Your cart is empty.')
            return res.redirect('/shop')
        }

        if (!shippingAddress) {
            req.flash('error', 'Please complete your shipping information.')
            return res.redirect('/checkout')
        }

        res.render('checkout-paypal', {
            pageTitle: 'PayPal payment',
            cart,
            shippingAddress,
            paypalClientId: process.env.PAYPAL_CLIENT_ID
        })
    }

    static async createOrder(req, res) {
        try {
            const cart = getCart(req.session)
            calculateTotals(cart)

            if (!cart.items.length) {
                return res.status(400).json({ error: 'Cart is empty.' })
            }

            const order = await createOrder(cart.totals.total.toFixed(2), 'SGD')
            res.json({ id: order.id })
        } catch (error) {
            console.error('PayPal create order error:', error.message)
            res.status(500).json({ error: error.message || 'Unable to create PayPal order.' })
        }
    }

    static async captureOrder(req, res) {
        try {
            const orderId = req.body.orderId
            if (!orderId) {
                return res.status(400).json({ error: 'Missing PayPal order id.' })
            }

            const capture = await captureOrder(orderId)
            const status = String(capture.status || '').toUpperCase()

            if (status !== 'COMPLETED') {
                return res.status(400).json({ error: 'PayPal payment not completed.' })
            }

            const { orderNumber } = await finalizeOrderFromSession(req)
            res.json({ success: true, orderNumber })
        } catch (error) {
            console.error('PayPal capture error:', error.message)
            res.status(500).json({ error: error.message || 'Unable to capture PayPal order.' })
        }
    }
}

module.exports = PayPalController
