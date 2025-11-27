const Product = require('../models/Product')

class HomeController {
    static async index(req, res) {
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
}

module.exports = HomeController
