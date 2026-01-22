Views that are actually rendered by the app (as of the current controllers):

- home page: `home.ejs`
- auth: `login.ejs`, `register.ejs`
- products: `shop.ejs`, `product-detail.ejs`, `product-form.ejs` (new + edit), `inventory.ejs`
- cart: `cart.ejs`
- checkout: `checkout.ejs`, `checkout-card.ejs`
- orders: `orders-history.ejs`, `orders-manage.ejs`
- users: `profile.ejs`, `users-manage.ejs`, `users-admin-edit.ejs`
- wishlist: `wishlist.ejs`
- layout partials live at `partials/*.ejs`

Old standalone templates (e.g., `addProduct.ejs`, `cart.ejs`, `inventory.ejs`) were removed because no route or controller rendered them. To add new pages, create a template directly under `views/` and render it via `res.render('<view-name>')` to keep everything flat.
