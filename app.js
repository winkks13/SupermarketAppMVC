/**
 * Supermarket App - Main Application File
 * Handles routing, middleware, and server configuration
 */

// Core dependencies
const express = require('express')
const mysql = require('mysql2')
const session = require('express-session')
const flash = require('connect-flash')
const multer = require('multer')

// Application Constants
const WEEK_IN_MS = 1000 * 60 * 60 * 24 * 7
const UPLOAD_DIR = 'public/images'
const PORT = process.env.PORT || 3000

// Database Configuration
const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: 'Republic_C207',
    database: 'c372_supermarketdb'
}

// File Upload Configuration
const uploadConfig = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => cb(null, file.originalname)
})

// Initialize Express Application
const app = express()
const upload = multer({ storage: uploadConfig })

/**
 * Database Connection Setup
 */
const connection = mysql.createConnection(DB_CONFIG)

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err)
        return
    }
    console.log('Connected to MySQL database')
})

/**
 * Application Configuration
 */
app.set('view engine', 'ejs')
app.use(express.static('public'))
app.use(express.urlencoded({ extended: false }))
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: WEEK_IN_MS }
}))
app.use(flash())

/**
 * Authentication Middleware
 */
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next()
        return
    }
    req.flash('error', 'Please log in to view this resource')
    res.redirect('/login')
}

/**
 * Authorization Middleware
 */
const checkAdmin = (req, res, next) => {
    if (req.session.user.role === 'admin') {
        next()
        return
    }
    req.flash('error', 'Access denied')
    res.redirect('/shopping')
}

/**
 * Validation Middleware
 */
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact, role } = req.body
    
    // Check required fields
    if (!username || !email || !password || !address || !contact || !role) {
        return res.status(400).send('All fields are required.')
    }
    
    // Validate password length
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long')
        req.flash('formData', req.body)
        return res.redirect('/register')
    }
    
    next()
}

/**
 * Route Handlers
 */

// SQL Queries
const SQL = {
    GET_ALL_PRODUCTS: 'SELECT * FROM products',
    REGISTER_USER: 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)',
    LOGIN_USER: 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)'
}

// Home page
app.get('/', (req, res) => {
    res.render('index', { 
        user: req.session.user 
    })
})

// Inventory management (admin only)
app.get('/inventory', checkAuthenticated, checkAdmin, (req, res) => {
    connection.query(SQL.GET_ALL_PRODUCTS, (error, results) => {
        if (error) throw error
        res.render('inventory', { 
            products: results, 
            user: req.session.user 
        })
    })
})

// User registration
app.get('/register', (req, res) => {
    res.render('register', { 
        messages: req.flash('error'), 
        formData: req.flash('formData')[0] 
    })
})

app.post('/register', validateRegistration, (req, res) => {
    const { username, email, password, address, contact, role } = req.body
    
    connection.query(
        SQL.REGISTER_USER, 
        [username, email, password, address, contact, role],
        (err, result) => {
            if (err) throw err
            console.log(result)
            req.flash('success', 'Registration successful! Please log in.')
            res.redirect('/login')
        }
    )
})

// User authentication
app.get('/login', (req, res) => {
    res.render('login', { 
        messages: req.flash('success'), 
        errors: req.flash('error') 
    })
})

app.post('/login', (req, res) => {
    const { email, password } = req.body

    if (!email || !password) {
        req.flash('error', 'All fields are required.')
        return res.redirect('/login')
    }

    connection.query(
        SQL.LOGIN_USER, 
        [email, password],
        (err, results) => {
            if (err) throw err

            if (results.length > 0) {
                req.session.user = results[0]
                req.flash('success', 'Login successful!')
                res.redirect(req.session.user.role === 'user' ? '/shopping' : '/inventory')
            } else {
                req.flash('error', 'Invalid email or password.')
                res.redirect('/login')
            }
        }
    )
})

// Shopping page (authenticated users)
app.get('/shopping', checkAuthenticated, (req, res) => {
    connection.query(SQL.GET_ALL_PRODUCTS, (error, results) => {
        if (error) throw error
        res.render('shopping', { 
            user: req.session.user, 
            products: results 
        })
    })
})

/**
 * Shopping Cart Routes
 */
app.post('/add-to-cart/:id', checkAuthenticated, (req, res) => {
    const productId = parseInt(req.params.id)
    const quantity = parseInt(req.body.quantity) || 1

    connection.query(
        'SELECT * FROM products WHERE id = ?', 
        [productId], 
        (error, results) => {
            if (error) throw error

            if (!results.length) {
                return res.status(404).send("Product not found")
            }

            const product = results[0]
            req.session.cart = req.session.cart || []

            const existingItem = req.session.cart.find(item => item.productId === productId)
            if (existingItem) {
                existingItem.quantity += quantity
            } else {
                req.session.cart.push({
                    id: product.productId,
                    productName: product.productName,
                    price: product.price,
                    quantity: quantity,
                    image: product.image
                })
            }

            res.redirect('/cart')
        }
    )
})

app.get('/cart', checkAuthenticated, (req, res) => {
    res.render('cart', { 
        cart: req.session.cart || [], 
        user: req.session.user 
    })
})

/**
 * Authentication Routes
 */
app.get('/logout', (req, res) => {
    req.session.destroy()
    res.redirect('/')
})

/**
 * Product Management Routes
 */
app.get('/product/:id', checkAuthenticated, (req, res) => {
    connection.query(
        'SELECT * FROM products WHERE id = ?', 
        [req.params.id],
        (error, results) => {
            if (error) throw error

            if (!results.length) {
                return res.status(404).send('Product not found')
            }

            res.render('product', { 
                product: results[0], 
                user: req.session.user 
            })
        }
    )
})

app.get('/addProduct', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('addProduct', { user: req.session.user })
})

app.post('/addProduct', upload.single('image'), (req, res) => {
    const { name, quantity, price } = req.body
    const image = req.file ? req.file.filename : null

    connection.query(
        'INSERT INTO products (productName, quantity, price, image) VALUES (?, ?, ?, ?)',
        [name, quantity, price, image],
        (error) => {
            if (error) {
                console.error("Error adding product:", error)
                return res.status(500).send('Error adding product')
            }
            res.redirect('/inventory')
        }
    )
})

app.get('/updateProduct/:id', checkAuthenticated, checkAdmin, (req, res) => {
    connection.query(
        'SELECT * FROM products WHERE id = ?',
        [req.params.id],
        (error, results) => {
            if (error) throw error

            if (!results.length) {
                return res.status(404).send('Product not found')
            }

            res.render('updateProduct', { product: results[0] })
        }
    )
})

app.post('/updateProduct/:id', upload.single('image'), (req, res) => {
    const { name, quantity, price, currentImage } = req.body
    const image = req.file ? req.file.filename : currentImage

    connection.query(
        'UPDATE products SET productName = ?, quantity = ?, price = ?, image = ? WHERE id = ?',
        [name, quantity, price, image, req.params.id],
        (error) => {
            if (error) {
                console.error("Error updating product:", error)
                return res.status(500).send('Error updating product')
            }
            res.redirect('/inventory')
        }
    )
})

app.get('/deleteProduct/:id', (req, res) => {
    connection.query(
        'DELETE FROM products WHERE id = ?',
        [req.params.id],
        (error) => {
            if (error) {
                console.error("Error deleting product:", error)
                return res.status(500).send('Error deleting product')
            }
            res.redirect('/inventory')
        }
    )
})

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
