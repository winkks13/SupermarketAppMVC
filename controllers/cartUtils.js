const TAX_RATE = 0.08

function getCart(session) {
    if (!session.cart) {
        session.cart = {
            items: [],
            totals: {
                subtotal: 0,
                tax: 0,
                total: 0
            }
        }
    }

    return session.cart
}

function calculateTotals(cart) {
    const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const tax = +(subtotal * TAX_RATE).toFixed(2)
    const total = +(subtotal + tax).toFixed(2)

    cart.totals = { subtotal, tax, total }
    return cart.totals
}

function clearCart(session) {
    session.cart = {
        items: [],
        totals: {
            subtotal: 0,
            tax: 0,
            total: 0
        }
    }
}

module.exports = {
    TAX_RATE,
    getCart,
    calculateTotals,
    clearCart
}
