import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db } from "./db.js";
dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN === "*" ? true : (process.env.FRONTEND_ORIGIN || true) }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/products", (req,res)=>{
  res.json(db.prepare("SELECT id,category,name,price,qty,image FROM products ORDER BY category,name").all());
});

app.post("/api/checkout", (req,res)=>{
  const {items, customer={}, delivery={}, telegramUser={}} = req.body;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({error:"Корзина пустая"});
  const err = validateDelivery(delivery);
  if (err) return res.status(400).json({error:err});

  const tx = db.transaction(()=>{
    let total = 0;
    const fullItems = [];
    for (const it of items) {
      const id = Number(it.productId), q = Number(it.quantity);
      if (!Number.isInteger(id) || !Number.isInteger(q) || q <= 0) throw new Error("Некорректный товар");
      const p = db.prepare("SELECT * FROM products WHERE id=?").get(id);
      if (!p) throw new Error("Товар не найден");
      if (p.qty < q) throw new Error(`Недостаточно товара: ${p.name}. В наличии: ${p.qty}`);
      total += p.price * q;
      fullItems.push({productId:id, name:p.name, price:p.price, quantity:q});
    }

    const order = db.prepare(`INSERT INTO orders
      (telegram_user_id,telegram_username,customer_name,phone,total,status,delivery_type,delivery_city,delivery_address,delivery_comment)
      VALUES (?,?,?,?,?,'waiting_payment',?,?,?,?)`).run(
        telegramUser.id ? String(telegramUser.id) : "",
        telegramUser.username ? String(telegramUser.username) : "",
        customer.name || "",
        customer.phone || "",
        total,
        delivery.type || "",
        delivery.city || "",
        delivery.address || "",
        delivery.comment || ""
      );

    const addItem = db.prepare("INSERT INTO order_items (order_id,product_id,name,price,quantity) VALUES (?,?,?,?,?)");
    const dec = db.prepare("UPDATE products SET qty=qty-? WHERE id=? AND qty>=?");
    for (const it of fullItems) {
      const r = dec.run(it.quantity, it.productId, it.quantity);
      if (!r.changes) throw new Error(`Не удалось списать товар: ${it.name}`);
      addItem.run(order.lastInsertRowid, it.productId, it.name, it.price, it.quantity);
    }
    return {orderId: order.lastInsertRowid, total, items: fullItems};
  });

  try {
    const order = tx();
    notifyNewOrder(order, customer, delivery, telegramUser).catch(()=>{});
    res.json({ok:true, orderId: order.orderId, total: order.total, status:"waiting_payment"});
  } catch(e) {
    res.status(409).json({error:e.message});
  }
});

app.post("/api/orders/:id/paid", (req,res)=>{
  const id = Number(req.params.id);
  const order = db.prepare("SELECT * FROM orders WHERE id=?").get(id);
  if (!order) return res.status(404).json({error:"Заказ не найден"});
  db.prepare("UPDATE orders SET status='payment_check' WHERE id=?").run(id);
  notifyPaid(order).catch(()=>{});
  res.json({ok:true, status:"payment_check"});
});

function validateDelivery(d) {
  if (!d.type) return "Выберите способ доставки";
  if (d.type === "self_delivery") {
    const city = String(d.city || "").toLowerCase();
    if (!["кемерово","анжеро-судженск"].includes(city)) return "Личная доставка только Кемерово и Анжеро-Судженск";
  }
  if ((d.type === "cdek" || d.type === "ozon") && (!d.city || !d.address)) return "Укажите город и адрес/ПВЗ";
  return "";
}

async function sendMsg(text) {
  const token = process.env.BOT_TOKEN, chatId = process.env.ADMIN_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({chat_id:chatId, text})
  });
}

async function notifyNewOrder(o,c,d,u) {
  const deliveryName = ({cdek:"СДЭК", ozon:"Ozon", self_delivery:"Привезти лично"})[d.type] || d.type;
  const lines = o.items.map((x,i)=>`${i+1}. ${x.name} — ${x.quantity} шт. — ${x.price} ₽`).join("\n");
  await sendMsg(`Новый заказ #${o.orderId}\nСтатус: ожидает QR-оплату\n\n${lines}\n\nИтого: ${o.total} ₽\n\nДоставка: ${deliveryName}\nГород: ${d.city||"-"}\nАдрес/ПВЗ: ${d.address||"-"}\nКомментарий: ${d.comment||"-"}\n\nКлиент: ${c.name||"-"}\nТелефон: ${c.phone||"-"}\nTelegram: ${u.username ? "@"+u.username : (u.id||"-")}`);
}

async function notifyPaid(o) {
  await sendMsg(`Клиент нажал “Я оплатил”\nЗаказ #${o.id}\nСумма: ${o.total} ₽\nКлиент: ${o.customer_name||"-"}\nТелефон: ${o.phone||"-"}\n\nПроверь поступление/чек вручную.`);
}

import "./seed.js";

app.listen(process.env.PORT || 3000, () => console.log("Server started"));
