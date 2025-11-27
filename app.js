require('dotenv').config()

const path = require('path')
const express = require('express')
const session = require('express-session')
const flash = require('connect-flash')

const { attachLocals } = require('./middleware/auth')

const homeRoutes = require('./routes/homeRoutes')
const authRoutes = require('./routes/authRoutes')
const productRoutes = require('./routes/productRoutes')
const cartRoutes = require('./routes/cartRoutes')
const userRoutes = require('./routes/userRoutes')
const orderRoutes = require('./routes/orderRoutes')

const app = express()
const PORT = process.env.PORT || 3000

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

app.use('/', homeRoutes)
app.use('/', authRoutes)
app.use('/', userRoutes)
app.use('/', productRoutes)
app.use('/', cartRoutes)
app.use('/', orderRoutes)

app.use((_req, res) => {
    res.status(404).render('errors/404', {
        pageTitle: 'Page not found'
    })
})

app.listen(PORT, () => {
    console.log(`WinksMart is running on port ${PORT}`)
})
