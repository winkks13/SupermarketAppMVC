const { getCart } = require('./controllers/cartUtils')

const ensureAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next()
    }

    req.flash('error', 'Please log in to continue.')
    res.redirect('/login')
}

const ensureAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next()
    }

    req.flash('error', 'Admin access required.')
    res.redirect('/shop')
}

const attachLocals = (req, res, next) => {
    res.locals.currentUser = req.session.user
    const cart = getCart(req.session)
    res.locals.cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0)
    res.locals.successMessages = req.flash('success')
    res.locals.errorMessages = req.flash('error')
    next()
}

module.exports = {
    ensureAuthenticated,
    ensureAdmin,
    attachLocals
}
