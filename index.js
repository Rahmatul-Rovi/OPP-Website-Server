const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ik4rm14.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    // ✅ MUST CONNECT
    await client.connect();

    const database = client.db("onePointPlusDB");
    const productCollection = database.collection("products");
    const userCollection = database.collection("users");

    console.log("MongoDB Connected Successfully");

    // ================= PRODUCTS =================

    // GET ALL PRODUCTS
    app.get('/products', async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });

    // ADD PRODUCT
    app.post('/products', async (req, res) => {
      try {
        const product = req.body;

        const newProduct = {
          title: product.title || "",
          image: product.image || "",
          category: product.category || "General",
          description: product.description || "",
          price: Number(product.price) || 0,   // ✅ SAFE NUMBER
          stock: Number(product.stock) || 0,   // ✅ SAFE NUMBER
          discount: 0,
          createdAt: new Date()
        };

        const result = await productCollection.insertOne(newProduct);
        res.send(result);

      } catch (error) {
        res.status(500).send({ message: "Product save error" });
      }
    });

    // DELETE PRODUCT
    app.delete('/products/:id', async (req, res) => {
      const id = req.params.id;
      const result = await productCollection.deleteOne({
        _id: new ObjectId(id)
      });
      res.send(result);
    });

    // UPDATE PRODUCT
    app.patch('/products/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const data = req.body;

        let updateData = {};

        if (data.stock !== undefined)
          updateData.stock = Number(data.stock) || 0;

        if (data.price !== undefined)
          updateData.price = Number(data.price) || 0;

        if (data.discount !== undefined)
          updateData.discount = Number(data.discount) || 0;

        const result = await productCollection.updateOne(
          filter,
          { $set: updateData }
        );

        res.send(result);

      } catch (error) {
        res.status(500).send({ message: "Update failed" });
      }
    });


    // Sales Schema (Mongoose) - Jodi thake, na thakle eita follow koro
// { items: Array, totalAmount: Number, date: Date }

// Backend (Express.js) logic
app.post('/api/checkout', async (req, res) => {
  try {
    const { cart, totalAmount } = req.body;

    if (!cart || cart.length === 0) {
      return res.status(400).send({ message: "Cart is empty" });
    }

    // Protita product-er stock update korar jonno loop
    const updatePromises = cart.map(async (item) => {
      return productCollection.updateOne(
        { _id: new ObjectId(item._id) }, // _id ke ObjectId-te convert kora MUST
        { $inc: { stock: -item.quantity } } // Stock quantity onujayi kombe
      );
    });

    await Promise.all(updatePromises);

    // Sale record save kora (Optional: Jate dashboard-e revenue dekha jay)
    const saleRecord = {
      items: cart,
      totalAmount: totalAmount,
      date: new Date(),
    };
    // await salesCollection.insertOne(saleRecord); 

    res.status(200).send({ success: true, message: "Checkout Done & Stock Updated!" });
  } catch (error) {
    console.error("Checkout Error Backend:", error);
    res.status(500).send({ success: false, error: error.message });
  }
});



    // ================= USERS =================

    app.post('/users', async (req, res) => {
      const user = req.body;
      const existingUser = await userCollection.findOne({ email: user.email });

      if (existingUser) {
        return res.send({ message: 'User already exists' });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: 'admin' } }
      );
      res.send(result);
    });

  } catch (error) {
    console.error("Connection error:", error);
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Server Running...');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});