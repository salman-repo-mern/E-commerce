const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { User, Product, Cart, Order } = require("./models");
const { auth, role } = require("./middlewares");

// -------- AUTH ---------

router.post("/auth/register", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password)
      return res.status(400).json({ msg: "Missing fields" });

    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ msg: "User exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashed, role: role || "customer" });
    await user.save();

    res.json({ msg: "User registered" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ msg: "Missing fields" });

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ msg: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({ token, role: user.role });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// -------- PRODUCTS ---------

// GET all with search & pagination
router.get("/products", async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10 } = req.query;
    const query = search
      ? { name: { $regex: search, $options: "i" } }
      : {};

    const products = await Product.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json(products);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// Admin routes - add/update/delete
router.post("/products", auth, role("admin"), async (req, res) => {
  try {
    const { name, description, price, category } = req.body;
    if (!name || !price)
      return res.status(400).json({ msg: "Missing fields" });

    const product = new Product({ name, description, price, category });
    await product.save();

    res.json({ msg: "Product created" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

router.put("/products/:id", auth, role("admin"), async (req, res) => {
  try {
    const { name, description, price, category } = req.body;
    await Product.findByIdAndUpdate(req.params.id, {
      name,
      description,
      price,
      category,
    });
    res.json({ msg: "Product updated" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

router.delete("/products/:id", auth, role("admin"), async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ msg: "Product deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// -------- CART ---------

router.get("/cart", auth, async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.user.id }).populate("items.product");
    if (!cart) {
      cart = new Cart({ userId: req.user.id, items: [] });
      await cart.save();
    }
    res.json(cart);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

router.post("/cart", auth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    if (!productId || quantity < 1)
      return res.status(400).json({ msg: "Invalid data" });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ msg: "Product not found" });

    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      cart = new Cart({ userId: req.user.id, items: [] });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );
    if (itemIndex > -1) {
      cart.items[itemIndex].quantity = quantity;
    } else {
      cart.items.push({ product: productId, quantity });
    }
    await cart.save();

    res.json({ msg: "Cart updated" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

router.delete("/cart/:productId", auth, async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) return res.status(404).json({ msg: "Cart not found" });

    cart.items = cart.items.filter(
      (item) => item.product.toString() !== req.params.productId
    );
    await cart.save();

    res.json({ msg: "Item removed from cart" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// -------- ORDER ---------

router.post("/orders", auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id }).populate(
      "items.product"
    );
    if (!cart || cart.items.length === 0)
      return res.status(400).json({ msg: "Cart is empty" });

    const totalPrice = cart.items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );

    const order = new Order({
      userId: req.user.id,
      items: cart.items.map((item) => ({
        product: item.product._id,
        quantity: item.quantity,
      })),
      totalPrice,
    });

    await order.save();

    cart.items = [];
    await cart.save();

    res.json({ msg: "Order placed", orderId: order._id });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

router.get("/orders", auth, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id }).populate(
      "items.product"
    );
    res.json(orders);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
