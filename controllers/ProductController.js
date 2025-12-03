const Product = require('../models/Product')
const Review = require('../models/Review')
const Wishlist = require('../models/Wishlist')

const getId = (req) => req.params.id

const SORT_OPTIONS = [
    { id: 'default', label: 'Recommended' },
    { id: 'price-asc', label: 'Price: Low to High' },
    { id: 'price-desc', label: 'Price: High to Low' }
]

const normalizeSortSelection = (input) => {
    const match = SORT_OPTIONS.find(option => option.id === input)
    return match ? match.id : 'default'
}

class ProductController {
    static async showHome(req, res) {
        try {
            const isAdmin = req.session?.user?.role === 'admin'
            const featuredPromise = Product.findFeatured(4)
            const statsPromise = isAdmin ? Product.getInventoryStats() : null

            const [featured, stats] = await Promise.all([
                featuredPromise,
                statsPromise
            ])

            res.render('home', {
                pageTitle: 'WinksMart',
                featured,
                stats: stats || null
            })
        } catch (err) {
            console.error(err)
            res.render('home', {
                pageTitle: 'WinksMart',
                featured: [],
                stats: null
            })
        }
    }

    static async showShop(req, res) {
        try {
            const sort = normalizeSortSelection(req.query.sort)

            const [products, categories, stats, wishlistedIds] = await Promise.all([
                Product.findAll({
                    search: req.query.search,
                    category: req.query.category,
                    sort: sort === 'default' ? null : sort
                }),
                Product.getCategories(),
                Product.getInventoryStats(),
                Wishlist.getProductIdsForUser(req.session.user.id)
            ])

            const summaries = await Review.getSummaryByProductIds(products.map(p => p.id))

            res.render('shop', {
                pageTitle: 'Shop Fresh Groceries',
                products: products.map(product => {
                    const summary = summaries[product.id] || { avgRating: 5, reviewCount: 0 }
                    return {
                        ...product,
                        rating: summary.avgRating,
                        reviewCount: summary.reviewCount,
                        isWishlisted: wishlistedIds.includes(product.id)
                    }
                }),
                categories,
                filters: {
                    search: req.query.search || '',
                    category: req.query.category || 'all',
                    sort
                },
                sortOptions: SORT_OPTIONS,
                stats,
                active: 'shop'
            })
        } catch (err) {
            console.error(err)
            req.flash('error', 'Unable to load products at the moment.')
            res.redirect('/')
        }
    }

    static async showInventory(req, res) {
        try {
            const [products, stats] = await Promise.all([
                Product.findAll(),
                Product.getInventoryStats()
            ])

            res.render('inventory', {
                pageTitle: 'Inventory Management',
                products,
                stats,
                active: 'inventory'
            })
        } catch (err) {
            console.error(err)
            req.flash('error', 'Unable to load inventory.')
            res.redirect('/')
        }
    }

    static async showDetail(req, res) {
        try {
            const product = await Product.findById(getId(req))
            if (!product) {
                req.flash('error', 'Product not found.')
                return res.redirect('/shop')
            }

            const [reviews, summary, wishlistedIds] = await Promise.all([
                Review.findByProduct(product.id),
                Review.getSummaryByProductIds([product.id]),
                Wishlist.getProductIdsForUser(req.session.user.id)
            ])

            const ratingSummary = summary[product.id] || { avgRating: 5, reviewCount: 0 }

            const description = [
                `Discover our ${product.productName}`,
                product.category ? `from the ${product.category} aisle` : 'freshly stocked for you',
                `— perfect for everyday meals and ready to checkout.`
            ].join(' ')

            res.render('product-detail', {
                pageTitle: product.productName,
                product,
                description,
                reviews,
                rating: ratingSummary,
                isWishlisted: wishlistedIds.includes(product.id)
            })
        } catch (err) {
            console.error(err)
            req.flash('error', 'Unable to load product.')
            res.redirect('/shop')
        }
    }

    static showCreateForm(_req, res) {
        res.render('product-form', {
            pageTitle: 'Add New Product',
            product: {},
            isEdit: false
        })
    }

    static async create(req, res) {
        try {
            const payload = {
                productName: req.body.productName,
                price: Number(req.body.price) || 0,
                category: req.body.category,
                quantity: Number(req.body.quantity) || 0,
                image: req.file ? req.file.filename : 'apples.png'
            }

            await Product.create(payload)
            req.flash('success', 'Product added successfully.')
            res.redirect('/inventory')
        } catch (err) {
            console.error(err)
            req.flash('error', 'Unable to add product. Please try again.')
            res.redirect('/products/new')
        }
    }

    static async showEditForm(req, res) {
        try {
            const product = await Product.findById(getId(req))
            if (!product) {
                req.flash('error', 'Product not found.')
                return res.redirect('/inventory')
            }

            res.render('product-form', {
                pageTitle: 'Edit Product',
                product,
                isEdit: true
            })
        } catch (err) {
            console.error(err)
            req.flash('error', 'Unable to load product information.')
            res.redirect('/inventory')
        }
    }

    static async update(req, res) {
        try {
            const updates = {
                productName: req.body.productName,
                price: Number(req.body.price) || 0,
                category: req.body.category,
                quantity: Number(req.body.quantity) || 0,
                image: req.file ? req.file.filename : (req.body.currentImage || 'apples.png')
            }

            await Product.update(getId(req), updates)
            req.flash('success', 'Product updated successfully.')
            res.redirect('/inventory')
        } catch (err) {
            console.error(err)
            req.flash('error', 'Unable to update product.')
            res.redirect(`/products/${getId(req)}/edit`)
        }
    }

    static async remove(req, res) {
        try {
            await Product.remove(getId(req))
            req.flash('success', 'Product removed.')
        } catch (err) {
            console.error(err)
            req.flash('error', 'Unable to delete product.')
        }

        res.redirect('/inventory')
    }

    static async addReview(req, res) {
        try {
            const product = await Product.findById(getId(req))
            if (!product) {
                req.flash('error', 'Product not found.')
                return res.redirect('/shop')
            }

            await Review.create({
                productId: product.id,
                userId: req.session.user.id,
                rating: req.body.rating || 5,
                comment: req.body.comment || ''
            })

            req.flash('success', 'Review submitted. Thank you!')
        } catch (err) {
            console.error(err)
            req.flash('error', 'Unable to submit review right now.')
        }

        res.redirect(`/products/${getId(req)}`)
    }
}

module.exports = ProductController
