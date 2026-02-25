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

    app.get('/products/:id', async (req, res) => {
  try {
    const id = req.params.id; 
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid ID format" });
    }

    const query = { _id: new ObjectId(id) }; // MongoDB query format
    const result = await productCollection.findOne(query);

    if (!result) {
      return res.status(404).send({ message: "Product not found" });
    }

    res.send(result); 
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
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
          price: Number(product.price) || 0, 
          stock: Number(product.stock) || 0,  
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


// { items: Array, totalAmount: Number, date: Date }

// Backend (Express.js) logic
app.post('/api/checkout', async (req, res) => {
  try {
    const { cart, totalAmount, invoiceNo, customerName, customerPhone } = req.body;

    if (!cart || cart.length === 0) {
      return res.status(400).send({ message: "Cart is empty" });
    }

    //  Stock update (Bulk Write)
    const bulkOps = cart.map(item => ({
      updateOne: {
        filter: { _id: new ObjectId(item._id) },
        update: { $inc: { stock: -item.quantity } }
      }
    }));
    await productCollection.bulkWrite(bulkOps);

    //  SALE RECORD SAVE
    const saleRecord = {
      invoiceNo,
      customerName: customerName || "Walk-in Guest",
      customerPhone: customerPhone || "N/A",
      cart: cart,
      totalAmount,
      date: new Date(), // Real time date
    };

    // Sales collection insert
    const salesCollection = database.collection("sales");
    const result = await salesCollection.insertOne(saleRecord);

    res.status(200).send({ success: true, message: "Sale Recorded!", result });
  } catch (error) {
    console.error("Checkout Error:", error);
    res.status(500).send({ success: false, error: error.message });
  }
});

// 2. GET ALL SALES - Admin table
app.get('/all-sales', async (req, res) => {
  try {
    const salesCollection = database.collection("sales");
    const result = await salesCollection.find().sort({ date: -1 }).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error fetching sales" });
  }
});


//==================Admin======================
app.get('/admin-stats', async (req, res) => {
  const sales = await database.collection("sales").find().toArray();
  
  const today = new Date().toLocaleDateString();

  const totalIncome = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalSales = sales.length;

  const todaySalesArr = sales.filter(sale => new Date(sale.date).toLocaleDateString() === today);
  const todayIncome = todaySalesArr.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const todaySalesCount = todaySalesArr.length;

  // FIX: Grouping sales by date for the last 7 days
  const last7DaysData = {};
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short' });
    last7DaysData[dateStr] = { name: dateStr, amount: 0, count: 0 };
  }

  // Sales data sum
  sales.forEach(sale => {
    const saleDate = new Date(sale.date).toLocaleDateString('en-US', { weekday: 'short' });
    if (last7DaysData[saleDate]) {
      last7DaysData[saleDate].amount += sale.totalAmount;
      last7DaysData[saleDate].count += 1;
    }
  });

  const graphData = Object.values(last7DaysData);

  res.send({ totalIncome, totalSales, todayIncome, todaySalesCount, graphData });
});

app.get('/users/admin/:email', async (req, res) => {
  const email = req.params.email;
  const user = await userCollection.findOne({ email });
  res.send({ admin: user?.role === 'admin' });
});

    // ================= USERS =================

   // User database-e add
app.post('/users', async (req, res) => {
  const user = req.body;
  const query = { email: user.email };
  const updateDoc = {
    $set: {
      name: user.name,
      email: user.email,
      role: user.role || 'user',
      lastLogin: new Date()
    }
  };
  const options = { upsert: true };
  const result = await userCollection.updateOne(query, updateDoc, options);
  res.send(result);
});

    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

   // Role 'user' to 'admin'
app.patch('/users/admin/:id', async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: { role: 'admin' }
  };
  const result = await userCollection.updateOne(filter, updateDoc);
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