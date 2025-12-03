const Wishlist = require('../models/Wishlist')
const Product = require('../models/Product')
const Review = require('../models/Review')

class WishlistController {
    static async add(req, res) {
        try {
            const product = await Product.findById(req.params.id)
            if (!product) {
                req.flash('error', 'Product not found.')
                return res.redirect('/shop')
            }

            await Wishlist.add(req.session.user.id, product.id)
            req.flash('success', `${product.productName} added to wishlist.`)
        } catch (err) {
            console.error(err)
            req.flash('error', 'Unable to add to wishlist right now.')
        }
        res.redirect(req.get('Referrer') || '/shop')
    }

    static async remove(req, res) {
        try {
            await Wishlist.remove(req.session.user.id, req.params.id)
            req.flash('success', 'Removed from wishlist.')
        } catch (err) {
            console.error(err)
            req.flash('error', 'Unable to update wishlist right now.')
        }
        res.redirect(req.get('Referrer') || '/shop')
    }

    static async list(req, res) {
        try {
            const ids = await Wishlist.getProductIdsForUser(req.session.user.id)
            if (!ids.length) {
                return res.render('wishlist', {
                    pageTitle: 'Your wishlist',
                    products: [],
                    active: 'wishlist'
                })
            }

            const products = await Product.findByIds(ids)
            const summaries = await Review.getSummaryByProductIds(products.map(p => p.id))

            const enriched = products.map(product => {
                const summary = summaries[product.id] || { avgRating: 5, reviewCount: 0 }
                return {
                    ...product,
                    rating: summary.avgRating,
                    reviewCount: summary.reviewCount
                }
            })

            res.render('wishlist', {
                pageTitle: 'Your wishlist',
                products: enriched,
                active: 'wishlist'
            })
        } catch (err) {
            console.error(err)
            req.flash('error', 'Unable to load your wishlist right now.')
            res.redirect('/shop')
        }
    }
}

module.exports = WishlistController
