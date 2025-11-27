const User = require('../models/User')

const REQUIRED_FIELDS = ['username', 'email', 'password', 'address', 'contact']

const buildProfilePayload = (body = {}) => ({
    username: (body.username || '').trim(),
    email: (body.email || '').trim(),
    address: (body.address || '').trim(),
    contact: (body.contact || '').trim()
})

const hasMissingProfileFields = (payload = {}) =>
    Object.values(payload).some(value => !value)

class UserController {
    static showRegister(_req, res) {
        res.render('auth/register', {
            pageTitle: 'Create an account'
        })
    }

    static async register(req, res) {
        try {
            const missing = REQUIRED_FIELDS.filter(field => !req.body[field])
            if (missing.length) {
                req.flash('error', 'Please fill in all required details.')
                return res.redirect('/register')
            }

            if (req.body.password.length < 6) {
                req.flash('error', 'Password should be at least 6 characters long.')
                return res.redirect('/register')
            }

            const existing = await User.findByEmail(req.body.email)
            if (existing) {
                req.flash('error', 'This email address is already registered.')
                return res.redirect('/register')
            }

            await User.create({
                username: req.body.username,
                email: req.body.email,
                password: req.body.password,
                address: req.body.address,
                contact: req.body.contact,
                role: 'user'
            })

            req.flash('success', 'Registration successful. Please sign in.')
            res.redirect('/login')
        } catch (err) {
            console.error(err)
            req.flash('error', 'We could not register you at the moment.')
            res.redirect('/register')
        }
    }

    static showLogin(_req, res) {
        res.render('auth/login', {
            pageTitle: 'Welcome back'
        })
    }

    static async login(req, res) {
        try {
            if (!req.body.email || !req.body.password) {
                req.flash('error', 'Email and Password are required.')
                return res.redirect('/login')
            }

            const user = await User.authenticate(req.body.email, req.body.password)
            if (!user) {
                req.flash('error', 'Invalid email or password.')
                return res.redirect('/login')
            }

            req.session.user = user
            req.flash('success', `Welcome back, ${user.username}!`)
            res.redirect(user.role === 'admin' ? '/inventory' : '/shop')
        } catch (err) {
            console.error(err)
            req.flash('error', 'Unable to sign you in right now.')
            res.redirect('/login')
        }
    }

    static logout(req, res) {
        req.session.destroy(() => {
            res.redirect('/')
        })
    }

    static async showProfile(req, res) {
        try {
            const user = await User.findById(Number(req.session.user.id))
            if (!user) {
                req.flash('error', 'Unable to load your profile.')
                return res.redirect('/shop')
            }

            res.render('users/profile', {
                pageTitle: 'Your profile',
                user,
                active: 'account'
            })
        } catch (err) {
            console.error(err)
            req.flash('error', 'Unable to load your profile.')
            res.redirect('/shop')
        }
    }

    static async updateProfile(req, res) {
        const userId = Number(req.session.user.id)
        if (!Number.isFinite(userId)) {
            req.flash('error', 'Invalid user identifier.')
            return res.redirect('/login')
        }

        const updates = buildProfilePayload(req.body)

        if (hasMissingProfileFields(updates)) {
            req.flash('error', 'All profile fields are required.')
            return res.redirect('/profile')
        }

        if (req.body.password) {
            if (req.body.password.length < 6) {
                req.flash('error', 'Password should be at least 6 characters long.')
                return res.redirect('/profile')
            }
            updates.password = req.body.password
        }

        try {
            const existing = await User.findByEmail(updates.email)
            if (existing && existing.id !== userId) {
                req.flash('error', 'This email is already used by another account.')
                return res.redirect('/profile')
            }

            await User.update(userId, updates)
            const refreshedUser = await User.findById(userId)
            req.session.user = refreshedUser

            req.flash('success', 'Profile updated successfully.')
            res.redirect('/profile')
        } catch (err) {
            console.error(err)
            req.flash('error', 'Unable to update your profile right now.')
            res.redirect('/profile')
        }
    }

    static async listUsers(_req, res) {
        try {
            const users = await User.findAll()
            res.render('users/manage', {
                pageTitle: 'User management',
                users,
                active: 'users'
            })
        } catch (err) {
            console.error(err)
            req.flash('error', 'Unable to load users.')
            res.redirect('/inventory')
        }
    }

    static async showAdminEdit(req, res) {
        try {
            const targetId = Number(req.params.id)
            if (!Number.isFinite(targetId)) {
                req.flash('error', 'Invalid user identifier.')
                return res.redirect('/admin/users')
            }

            const user = await User.findById(targetId)
            if (!user) {
                req.flash('error', 'User not found.')
                return res.redirect('/admin/users')
            }

            if (user.role === 'admin' && Number(req.session.user.id) !== Number(user.id)) {
                req.flash('error', 'Admins cannot edit other admin accounts.')
                return res.redirect('/admin/users')
            }

            res.render('users/admin-edit', {
                pageTitle: `Edit ${user.username}`,
                user,
                isSelf: Number(req.session.user.id) === Number(user.id),
                active: 'users'
            })
        } catch (err) {
            console.error(err)
            req.flash('error', 'Unable to load user details.')
            res.redirect('/admin/users')
        }
    }

    static async updateUser(req, res) {
        const targetId = Number(req.params.id)
        if (!Number.isFinite(targetId)) {
            req.flash('error', 'Invalid user identifier.')
            return res.redirect('/admin/users')
        }
        const updates = buildProfilePayload(req.body)

        if (hasMissingProfileFields(updates)) {
            req.flash('error', 'All fields are required.')
            return res.redirect(`/admin/users/${targetId}/edit`)
        }

        if (req.body.password) {
            if (req.body.password.length < 6) {
                req.flash('error', 'Password should be at least 6 characters long.')
                return res.redirect(`/admin/users/${targetId}/edit`)
            }
            updates.password = req.body.password
        }

        if (req.body.role) {
            updates.role = req.body.role === 'admin' ? 'admin' : 'user'
        }

        try {
            const targetUser = await User.findById(targetId)
            if (!targetUser) {
                req.flash('error', 'User not found.')
                return res.redirect('/admin/users')
            }

            const editingOtherAdmin =
                targetUser.role === 'admin' && Number(req.session.user.id) !== Number(targetUser.id)
            if (editingOtherAdmin) {
                req.flash('error', 'Admins cannot edit other admin accounts.')
                return res.redirect('/admin/users')
            }

            const existing = await User.findByEmail(updates.email)
            if (existing && existing.id !== targetId) {
                req.flash('error', 'This email is already used by another account.')
                return res.redirect(`/admin/users/${targetId}/edit`)
            }

            await User.update(targetId, updates, { allowRole: true })
            const refreshedUser = await User.findById(targetId)

            if (refreshedUser && Number(req.session.user.id) === Number(refreshedUser.id)) {
                req.session.user = refreshedUser
            }

            req.flash('success', 'User updated successfully.')
            res.redirect('/admin/users')
        } catch (err) {
            console.error(err)
            req.flash('error', 'Unable to update user.')
            res.redirect(`/admin/users/${targetId}/edit`)
        }
    }
}

module.exports = UserController
