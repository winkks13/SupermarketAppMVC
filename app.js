require('dotenv').config()

const path = require('path')
const express = require('express')
const session = require('express-session')
const flash = require('connect-flash')
const multer = require('multer')

const UserController = require('./controllers/UserController')
const ProductController = require('./controllers/ProductController')
const WishlistController = require('./controllers/WishlistController')
const CartController = require('./controllers/CartController')
const OrderController = require('./controllers/OrderController')
const { ensureAuthenticated, ensureAdmin, attachLocals } = require('./middleware')

const app = express()
const PORT = process.env.PORT || 3000

const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, path.join(__dirname, 'public', 'images')),
        filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
    })
})

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(express.static(path.join(__dirname, 'public')))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.use(session({
    secret: process.env.SESSION_SECRET || 'supermarket-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 6
    }
}))

app.use(flash())
app.use(attachLocals)

// Home
app.get('/', ProductController.showHome)

// Auth
app.get('/register', UserController.showRegister)
app.post('/register', UserController.register)
app.get('/login', UserController.showLogin)
app.post('/login', UserController.login)
app.post('/logout', UserController.logout)
app.get('/logout', UserController.logout)

// User profile/admin
app.get('/profile', ensureAuthenticated, UserController.showProfile)
app.post('/profile', ensureAuthenticated, UserController.updateProfile)
app.get('/admin/users', ensureAuthenticated, ensureAdmin, UserController.listUsers)
app.get('/admin/users/:id/edit', ensureAuthenticated, ensureAdmin, UserController.showAdminEdit)
app.post('/admin/users/:id', ensureAuthenticated, ensureAdmin, UserController.updateUser)

// Products and wishlist
app.get('/shop', ensureAuthenticated, ProductController.showShop)
app.get('/inventory', ensureAuthenticated, ensureAdmin, ProductController.showInventory)
app.get('/wishlist', ensureAuthenticated, WishlistController.list)

app.get('/products/new', ensureAuthenticated, ensureAdmin, ProductController.showCreateForm)
app.post('/products', ensureAuthenticated, ensureAdmin, upload.single('image'), ProductController.create)
app.get('/products/:id', ensureAuthenticated, ProductController.showDetail)
app.get('/products/:id/edit', ensureAuthenticated, ensureAdmin, ProductController.showEditForm)
app.post('/products/:id', ensureAuthenticated, ensureAdmin, upload.single('image'), ProductController.update)
app.post('/products/:id/delete', ensureAuthenticated, ensureAdmin, ProductController.remove)
app.post('/products/:id/reviews', ensureAuthenticated, ProductController.addReview)
app.post('/products/:id/wishlist/add', ensureAuthenticated, WishlistController.add)
app.post('/products/:id/wishlist/remove', ensureAuthenticated, WishlistController.remove)

// Cart
app.get('/cart', ensureAuthenticated, CartController.viewCart)
app.post('/cart/items/:productId', ensureAuthenticated, CartController.addItem)
app.post('/cart/items/:productId/update', ensureAuthenticated, CartController.updateItem)
app.post('/cart/items/:productId/delete', ensureAuthenticated, CartController.removeItem)
app.post('/cart/clear', ensureAuthenticated, CartController.emptyCart)

// Orders
app.get('/checkout', ensureAuthenticated, OrderController.showCheckout)
app.post('/checkout', ensureAuthenticated, OrderController.processCheckout)
app.get('/orders/history', ensureAuthenticated, OrderController.history)
app.get('/orders/manage', ensureAuthenticated, ensureAdmin, OrderController.adminList)
app.post('/orders/:orderId/status', ensureAuthenticated, ensureAdmin, OrderController.updateStatus)

app.use((_req, res) => {
    res.status(404).send('Page not found')
})

app.listen(PORT, () => {
    console.log(`WinksMart is running on port ${PORT}`)
})
